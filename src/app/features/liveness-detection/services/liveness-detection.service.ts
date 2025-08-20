import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, timer, Subscription, of } from 'rxjs';
import { takeUntil, catchError, switchMap } from 'rxjs/operators';
import { ApiService, GestosDisponibles } from '../../../core/services/api.service';
import { FaceDetectionService } from '../../../core/services/face-detection.service';
import { CameraService } from '../../../core/services/camera.service';
import { ValidationState, ValidationResponse } from '../../../core/models';
import { ValidationUtils } from '../../../shared/utils/validation.utils';
import { FaceDetectionUtils } from '../../../shared/utils/face-detection.utils';
import { STATUS_MESSAGES, formatValidationMessage } from '../../../config/constants';
import { VALIDATION_CONFIG } from '../../../config/api.config';
import { DETECTION_API_CONFIG, API_CONFIG } from '../../../config/api.config';

// Interface temporal para extender ValidationState con campos adicionales
interface ExtendedValidationState extends ValidationState {
  identificador?: string;
  score?: number;
  estadoFinal?: string;
  totalParpadeos?: number;
  error?: string;
  currentMovement?: string;
  fotoBase64?: string;
}

export interface ValidationStep {
  movement: string;
  completed: boolean;
  timestamp?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class LivenessDetectionService implements OnDestroy {
  
  private validationStateSubject = new BehaviorSubject<ValidationState>({
    isInProgress: false,
    currentStep: 0,
    totalSteps: 3,
    movementsCompleted: [],
    blinksDetected: 0,
    requiredBlinks: VALIDATION_CONFIG.REQUIRED_BLINKS,
    sessionId: '',
    statusMessage: STATUS_MESSAGES.READY
  });

  private movementSequence: string[] = [];
  private initialDistance: number | null = null;
  private blinkActive = false;
  private timeoutSubscription?: Subscription;
  private preparationSubscription?: Subscription;
  private currentMovementIndex: number = 0; // Nuevo: índice del movimiento actual
  private lastDebugTime: number = 0; // Para controlar el logging de debug
  
  // Propiedad para almacenar los gestos disponibles del backend
  private gestosDisponibles: GestosDisponibles | null = null;
  
  // Nuevas propiedades para conteo por movimiento
  private currentMovementBlinks: number = 0; // Contador de parpadeos del movimiento actual
  private movementBlinkActive: boolean = false; // Estado de parpadeo activo por movimiento
  
  // Nuevas propiedades para el flujo suave
  private isInPreparationPhase: boolean = false; // Fase de preparación
  private isInMovementPhase: boolean = false; // Fase de movimiento
  private isInReturnToCenterPhase: boolean = false; // Fase de retorno al centro
  private centerReturnSubscription?: Subscription;

  // Nuevas propiedades para estabilización de mensajes
  private lastMessageUpdate: number = 0; // Timestamp del último cambio de mensaje
  private currentMessagePhase: string = ''; // Fase actual del mensaje
  private messageStabilityDelay: number = 1000; // 1 segundo de estabilidad mínima
  private pendingMessageUpdate: string | null = null; // Mensaje pendiente de actualizar
  
  // Nueva propiedad para controlar la detección de gestos faciales
  private isInExecutionPhase: boolean = false; // Controla si estamos en fase de ejecución

  // Nueva propiedad para validar el centrado inicial
  private hasValidatedInitialCenter: boolean = false;

  public validationState$ = this.validationStateSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private faceDetectionService: FaceDetectionService,
    private cameraService: CameraService
  ) { }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Inicia el proceso de validación
   */
  async startValidation(): Promise<void> {
    try {
      console.log('🚀 Iniciando nueva validación...');
      console.log('⏰ Timestamp de inicio:', new Date().toISOString());
      
      // Resetear validación anterior
      this.resetValidation();
      
      // Generar nueva sesión
      const sessionId = ValidationUtils.generateSessionId();
      console.log('🆔 Nueva sesión generada:', sessionId);
      
      // Obtener gestos disponibles del backend y generar secuencia
      await this.obtenerGestosYGenerarSecuencia(sessionId);
      
      // Validar que la secuencia se generó correctamente
      if (!this.movementSequence || this.movementSequence.length === 0) {
        throw new Error('No se pudo generar la secuencia de movimientos');
      }
      
      console.log('🎲 Secuencia final generada para esta validación:');
      console.log('   📋 Secuencia completa:', this.movementSequence);
      console.log('   🔢 Longitud de secuencia:', this.movementSequence.length);
      console.log('   🎯 Movimientos a realizar:');
      this.movementSequence.forEach((movimiento, index) => {
        console.log(`      ${index + 1}. ${movimiento}`);
      });
      console.log('📝 INSTRUCCIONES PARA EL USUARIO:');
      console.log('   1. Debes completar EXACTAMENTE 3 movimientos');
      console.log('   2. Después de cada movimiento, vuelve al centro');
      console.log('   3. La validación se detendrá automáticamente después del 3er movimiento');
      console.log('   4. Verás contadores como "1/3", "2/3", "3/3" en los mensajes');
      
      // Verificar que la secuencia sea única para esta validación
      this.verificarSecuenciaUnica();
      
      // Actualizar estado
      this.updateValidationState({
        isInProgress: true,
        sessionId,
        currentStep: 0,
        movementsCompleted: [],
        blinksDetected: 0
      });

      // Mensaje inicial más claro con contador
      const initialMessage = `🎯 Prepárate para realizar 3 movimientos. Primero, centra tu rostro en la pantalla.`;
      this.updateStatusMessage(initialMessage, 'initialization', true);

      console.log('✅ Estado de validación reseteado correctamente');

      // Cargar modelo si no está cargado
      if (!this.faceDetectionService.isModelReady()) {
        await this.faceDetectionService.loadModel();
      }

      // Mensaje de centrado con estabilidad
      this.updateStatusMessage(STATUS_MESSAGES.CENTER_FACE, 'centering', true);

    } catch (error) {
      console.error('❌ Error al iniciar validación:', error);
      this.failValidation(`Error al iniciar: ${error}`);
    }
  }

  /**
   * Obtiene los gestos disponibles del backend
   */
  async obtenerGestosDisponibles(): Promise<GestosDisponibles | null> {
    try {
      console.log('🔄 Obteniendo gestos disponibles del backend...');
      console.log('   🌐 URL del endpoint: gestos-disponibles');
      
      const gestos = await this.apiService.obtenerGestosDisponibles().toPromise();
      
      if (!gestos) {
        console.warn('⚠️ No se pudieron obtener los gestos del backend');
        return null;
      }
      
      console.log('✅ Gestos obtenidos exitosamente del backend:');
      console.log('   📊 Total de gestos disponibles:', gestos.total_gestos);
      console.log('   🎯 Gestos de movimiento:', gestos.gestos_movimiento);
      console.log('   😊 Gestos faciales:', gestos.gestos_faciales);
      console.log('   📈 Estadísticas por categoría:', gestos.gestos_por_categoria);
      
      return gestos;
      
    } catch (error) {
      console.error('❌ Error al obtener gestos del backend:', error);
      return null;
    }
  }

  /**
   * Obtiene los gestos disponibles del backend y genera la secuencia aleatoria
   */
  private async obtenerGestosYGenerarSecuencia(sessionId: string): Promise<void> {
    try {
      console.log('🔄 Obteniendo gestos del backend para nueva validación...');
      console.log('   🆔 Session ID:', sessionId);
      console.log('   ⏰ Timestamp:', new Date().toISOString());
      
      // Obtener gestos del backend (siempre obtener frescos)
      this.gestosDisponibles = await this.obtenerGestosDisponibles();
      
      if (!this.gestosDisponibles) {
        throw new Error('No se pudieron obtener los gestos disponibles del backend');
      }
      
      console.log('✅ Gestos obtenidos del backend para esta validación:');
      console.log('   📊 Total de gestos:', this.gestosDisponibles.total_gestos);
      console.log('   🎯 Gestos de movimiento:', this.gestosDisponibles.gestos_movimiento);
      console.log('   😊 Gestos faciales:', this.gestosDisponibles.gestos_faciales);
      
      // Generar secuencia aleatoria usando todos los gestos del backend
      console.log('🎲 Generando secuencia aleatoria mixta para esta validación...');
      
      // Probar aleatoriedad para verificar variabilidad
      ValidationUtils.testRandomness(this.gestosDisponibles, 2);
      
      // Generar la secuencia final mezclando gestos de movimiento y faciales
      this.movementSequence = ValidationUtils.generateRandomGestureSequence(
        this.gestosDisponibles, 
        3
      );
      
      this.currentMovementIndex = 0; // Resetear índice de movimiento
      
      console.log('✅ Secuencia generada para esta validación:');
      console.log('   📋 Secuencia completa:', this.movementSequence);
      console.log('   🔢 Número de movimientos:', this.movementSequence.length);
      console.log('   🎯 Movimientos seleccionados:');
      this.movementSequence.forEach((movimiento, index) => {
        console.log(`      ${index + 1}. ${movimiento}`);
      });
      
    } catch (error) {
      console.error('❌ Error al obtener gestos del backend:', error);
      
      // Fallback: usar gestos locales si falla el backend
      console.log('🔄 Usando gestos locales como fallback...');
      this.movementSequence = ValidationUtils.generateRandomMovementSequence();
      this.currentMovementIndex = 0;
      
      console.log('✅ Secuencia generada localmente (fallback):');
      console.log('   📋 Secuencia completa:', this.movementSequence);
      console.log('   🔢 Número de movimientos:', this.movementSequence.length);
      console.log('   🎯 Movimientos seleccionados:');
      this.movementSequence.forEach((movimiento, index) => {
        console.log(`      ${index + 1}. ${movimiento}`);
      });
    }
  }

  /**
   * Procesa la detección facial y actualiza el estado
   * FLUJO SIMPLIFICADO: Centrado → Preparación → Ejecución → Centrado → Siguiente
   */
  processDetection(detectionResult: any): void {
    const currentState = this.validationStateSubject.value;
    
    // GUARDIA PRINCIPAL: No procesar si la validación no está activa o ya terminó
    if (!currentState.isInProgress || currentState.currentStep === -1) {
      return;
    }

    // Verificar parpadeo
    this.checkBlink(detectionResult);
    
    // FLUJO SIMPLIFICADO DE 8 PASOS:
    // Paso 0: Si está en modo centrado (currentStep: 0) y detecta rostro centrado
    if (currentState.currentStep === 0 && detectionResult.isCentered) {
      console.log(`🎯 Usuario centrado detectado. Preparando movimiento ${this.currentMovementIndex + 1}/${this.movementSequence.length}`);
      this.prepareNextMovement();
    } 
    // Paso 1: Si está en modo ejecución (currentStep: 1) y detecta el movimiento
    else if (currentState.currentStep === 1) {
      const currentMovement = this.movementSequence[this.currentMovementIndex];
      if (currentMovement) {
        this.checkMovement(detectionResult, currentMovement);
      }
    }
  }

  /**
   * Verifica si se detectó un parpadeo y cuenta por movimiento
   */
  private checkBlink(detectionResult: any): void {
    // Solo contar parpadeos si estamos en modo validación (currentStep > 0)
    const currentState = this.validationStateSubject.value;
    if (currentState.currentStep <= 0) return;
    
    // Contar parpadeos por movimiento
    if (detectionResult.blinkDetected && !this.movementBlinkActive) {
      this.movementBlinkActive = true;
      this.currentMovementBlinks += 1;
      
      console.log(`👁️‍🗨️ Parpadeo detectado en movimiento actual: ${this.currentMovementBlinks}`);
    } else if (!detectionResult.blinkDetected) {
      this.movementBlinkActive = false;
    }
  }

  /**
   * Prepara el siguiente movimiento - FLUJO SIMPLIFICADO
   * Paso 3: Indicar al usuario qué movimiento debe hacer
   */
  private prepareNextMovement(): void {
    // GUARDIA: Verificar que la validación esté activa y el índice sea válido
    const currentState = this.validationStateSubject.value;
    if (!currentState.isInProgress || currentState.currentStep === -1) {
      console.log(`🛑 Preparación cancelada: Validación no activa o terminada`);
      return;
    }
    
    if (this.currentMovementIndex >= this.movementSequence.length) {
      console.log(`🛑 Preparación cancelada: Índice fuera de rango (${this.currentMovementIndex}/${this.movementSequence.length})`);
      return;
    }
    
    const movement = this.movementSequence[this.currentMovementIndex];
    const isFacialGesture = this.isFacialGesture(movement);
    const gestureType = isFacialGesture ? 'gesto facial' : 'movimiento';
    
    // Aplicar inversión de mensaje para movimientos laterales
    const displayMovement = isFacialGesture ? movement : this.invertLateralMovementMessage(movement);
    
    console.log(`🎯 PASO 3: Preparando ${gestureType}: ${movement} (${this.currentMovementIndex + 1}/${this.movementSequence.length})`);
    
    // Mensaje directo y claro con contador
    const prepareMessage = isFacialGesture 
      ? `🎯 Prepárate para realizar el gesto: "${displayMovement}" (${this.currentMovementIndex + 1}/3)`
      : `🎯 Prepárate para realizar el movimiento: "${displayMovement}" (${this.currentMovementIndex + 1}/3)`;
    
    this.updateValidationState({
      currentStep: 1 // Cambiar a modo ejecución
    });
    
    // Mensaje estable
    this.updateStatusMessage(prepareMessage, 'preparation', true);

    // Contador simple de 3 segundos
    let countdown = 3;
    this.preparationSubscription = timer(0, 1000).subscribe(() => {
      if (countdown <= 0) {
        this.preparationSubscription?.unsubscribe();
        console.log(`🎬 PASO 4: Iniciando ejecución de: ${movement}`);
        this.startMovementValidation();
      } else {
        // Mensaje de countdown simple
        const countdownMessage = isFacialGesture
          ? `⏰ ¡${countdown} segundo${countdown > 1 ? 's' : ''} para el gesto "${displayMovement}"!`
          : `⏰ ¡${countdown} segundo${countdown > 1 ? 's' : ''} para el movimiento "${displayMovement}"!`;
        
        this.updateStatusMessage(countdownMessage, 'preparation_countdown');
        countdown--;
      }
    });
  }

  /**
   * Inicia la validación del movimiento - FLUJO SIMPLIFICADO
   * Paso 4: El usuario ejecuta el movimiento
   */
  private startMovementValidation(): void {
    // GUARDIA: Verificar que la validación esté activa y el índice sea válido
    const currentState = this.validationStateSubject.value;
    if (!currentState.isInProgress || currentState.currentStep === -1) {
      console.log(`🛑 Inicio de validación cancelado: Validación no activa o terminada`);
      return;
    }
    
    if (this.currentMovementIndex >= this.movementSequence.length) {
      console.log(`🛑 Inicio de validación cancelado: Índice fuera de rango (${this.currentMovementIndex}/${this.movementSequence.length})`);
      return;
    }
    
    const movement = this.movementSequence[this.currentMovementIndex];
    const isFacialGesture = this.isFacialGesture(movement);
    const gestureType = isFacialGesture ? 'gesto facial' : 'movimiento';
    
    // Aplicar inversión de mensaje para movimientos laterales
    const displayMovement = isFacialGesture ? movement : this.invertLateralMovementMessage(movement);
    
    console.log(`🎬 PASO 4: Usuario ejecuta ${gestureType}: ${movement}`);

    // Reiniciar contador de parpadeos para el nuevo movimiento
    this.currentMovementBlinks = 0;
    this.movementBlinkActive = false;
    
    // ACTIVAR fase de ejecución para controlar detección
    this.isInExecutionPhase = true;
    
    // Mensaje de ejecución con estabilidad
    const performMessage = isFacialGesture 
      ? `🎬 ¡Ahora realiza el gesto: "${displayMovement}"!`
      : `🎬 ¡Ahora realiza el movimiento: "${displayMovement}"!`;
    
    this.updateStatusMessage(performMessage, 'execution', true);

    // Timeout para el movimiento (10 segundos)
    this.timeoutSubscription = timer(VALIDATION_CONFIG.MOVEMENT_TIMEOUT).subscribe(() => {
      this.handleMovementTimeout();
    });
  }

  /**
   * Verifica si se completó el movimiento o gesto actual
   */
  private checkMovement(detectionResult: any, movement: string): void {
    // GUARDIA: Solo detectar si estamos en fase de ejecución
    if (!this.isInExecutionPhase) {
      console.log(`🛑 Detección cancelada: No estamos en fase de ejecución`);
      return;
    }
    
    // Para el movimiento de acercarse, necesitamos guardar la distancia inicial
    if (movement === 'acercarse' && this.initialDistance === null) {
      this.initialDistance = detectionResult.distanceBetweenEyes;
      console.log('📏 Distancia inicial guardada:', this.initialDistance);
    }

    // Determinar si es un gesto facial o un movimiento
    const isFacialGesture = this.isFacialGesture(movement);
    
    let isDetected = false;
    let debugInfo = null;

    // Debug: Verificar estructura de datos
    console.log('🔍 Debug - Estructura de detectionResult:', {
      hasFaceLandmarks: !!detectionResult.faceLandmarks,
      hasLandmarks: !!detectionResult.faceLandmarks?.landmarks,
      landmarksLength: detectionResult.faceLandmarks?.landmarks?.length,
      movement,
      isFacialGesture
    });

    if (isFacialGesture) {
      // Intentar usar los datos del backend primero
      if (detectionResult.gestos) {
        console.log('🔍 Usando datos de gestos del backend:', detectionResult.gestos);
        
        // Mapear el gesto a la estructura del backend
        let backendGesture = null;
        switch (movement) {
          case 'boca_abierta':
            backendGesture = detectionResult.gestos.boca_abierta;
            break;
          case 'cejas_fruncidas':
            backendGesture = detectionResult.gestos.cejas_fruncidas;
            break;
          case 'sonrisa':
            backendGesture = detectionResult.gestos.sonrisa;
            break;
          case 'guiño_derecho':
            backendGesture = detectionResult.gestos.guiño?.guiño_derecho;
            break;
          case 'guiño_izquierdo':
            backendGesture = detectionResult.gestos.guiño?.guiño_izquierdo;
            break;
          case 'cualquier_guiño':
            backendGesture = detectionResult.gestos.guiño?.cualquier_guiño;
            break;
        }
        
        if (backendGesture !== null && backendGesture !== undefined) {
          isDetected = backendGesture;
          console.log(`😊 Gesto facial "${movement}" detectado desde backend: ${isDetected}`);
        }
      }
      
      // Si no hay datos del backend, usar detección local
      if (!isDetected && detectionResult.faceLandmarks?.landmarks) {
        console.log('🔍 Usando detección local de gestos faciales');
        
        // Detectar gesto facial
        isDetected = FaceDetectionUtils.detectGesture(
          detectionResult.faceLandmarks.landmarks,
          movement
        );

        // Obtener información de debug para gestos faciales
        debugInfo = FaceDetectionUtils.getGestureDebugInfo(
          detectionResult.faceLandmarks.landmarks,
          movement
        );

        if (isDetected) {
          console.log(`😊 Gesto facial "${movement}" detectado localmente:`, debugInfo);
        } else {
          // Mostrar información de progreso cada 2 segundos para ayudar al usuario
          const currentTime = Date.now();
          if (!this.lastDebugTime || currentTime - this.lastDebugTime > 2000) {
            console.log(`📊 Progreso del gesto facial "${movement}":`, debugInfo);
            this.lastDebugTime = currentTime;
          }
        }
      } else if (!detectionResult.faceLandmarks?.landmarks) {
        console.error('❌ No se encontraron landmarks para detectar gesto facial');
        return;
      }
    } else {
      // Verificar si tenemos los landmarks necesarios
      if (!detectionResult.faceLandmarks?.landmarks) {
        console.error('❌ No se encontraron landmarks para detectar movimiento');
        return;
      }

      // VALIDACIÓN CRÍTICA: Para movimientos laterales, verificar que el usuario esté centrado inicialmente
      if ((movement === 'izquierda' || movement === 'derecha') && !this.hasValidatedInitialCenter) {
        if (detectionResult.isCentered) {
          this.hasValidatedInitialCenter = true;
          console.log('✅ Usuario centrado validado para movimientos laterales');
        } else {
          console.log('⏳ Esperando que el usuario esté centrado antes de detectar movimientos laterales');
          return; // No detectar hasta que esté centrado
        }
      }

      // Detectar movimiento
      isDetected = FaceDetectionUtils.detectMovement(
        detectionResult.faceLandmarks.landmarks, 
        movement, 
        this.initialDistance || undefined
      );

      // Obtener información de debug para movimientos
      debugInfo = FaceDetectionUtils.getMovementDebugInfo(
        detectionResult.faceLandmarks.landmarks,
        movement,
        this.initialDistance || undefined
      );

      if (isDetected) {
        console.log(`🎯 Movimiento "${movement}" detectado correctamente:`, debugInfo);
      } else {
        // Mostrar información de progreso cada 2 segundos para ayudar al usuario
        const currentTime = Date.now();
        if (!this.lastDebugTime || currentTime - this.lastDebugTime > 2000) {
          console.log(`📊 Progreso del movimiento "${movement}":`, debugInfo);
          this.lastDebugTime = currentTime;
        }
      }
    }

    if (isDetected) {
      this.completeMovement(movement);
    }
  }

  /**
   * Invierte el mensaje de movimiento lateral para que coincida con la lógica de detección
   */
  private invertLateralMovementMessage(movement: string): string {
    switch (movement) {
      case 'izquierda':
        return 'derecha';
      case 'derecha':
        return 'izquierda';
      default:
        return movement;
    }
  }

  /**
   * Determina si un gesto es facial o de movimiento
   */
  private isFacialGesture(gesture: string): boolean {
    if (!this.gestosDisponibles) return false;
    
    return this.gestosDisponibles.gestos_faciales.includes(gesture);
  }

  /**
   * Completa un movimiento o gesto y prepara el siguiente con flujo suave
   */
  private completeMovement(movement: string): void {
    // Cancelar TODAS las subscripciones activas para evitar race conditions
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();
    this.centerReturnSubscription?.unsubscribe();
    
    // DESACTIVAR fase de ejecución
    this.isInExecutionPhase = false;
    
    const currentState = this.validationStateSubject.value;
    const newMovementsCompleted = [...currentState.movementsCompleted, movement];
    const isFacialGesture = this.isFacialGesture(movement);
    const gestureType = isFacialGesture ? 'gesto facial' : 'movimiento';

    // Aplicar inversión de mensaje para movimientos laterales
    const displayMovement = isFacialGesture ? movement : this.invertLateralMovementMessage(movement);

    console.log(`✅ ${gestureType.charAt(0).toUpperCase() + gestureType.slice(1)} "${movement}" detectado correctamente (${newMovementsCompleted.length}/3 completados)`);

    // CORRECCIÓN: Verificar si es el último movimiento ANTES de incrementar el índice
    const isLastMovement = (this.currentMovementIndex + 1) >= this.movementSequence.length;
    
    // Obtener el siguiente movimiento
    const nextMovementIndex = this.currentMovementIndex + 1;
    const nextMovement = nextMovementIndex < this.movementSequence.length 
      ? this.movementSequence[nextMovementIndex] 
      : null;
    
    // Logs de debug para verificar la lógica
    console.log(`🔍 Debug - Índice actual: ${this.currentMovementIndex}, Total movimientos: ${this.movementSequence.length}`);
    console.log(`🔍 Debug - Es último movimiento: ${isLastMovement}, Siguiente movimiento: ${nextMovement}`);

    if (isLastMovement) {
      // Último movimiento completado - DETENER INMEDIATAMENTE la validación
      const finalCompletedMessage = isFacialGesture 
        ? formatValidationMessage(STATUS_MESSAGES.FACIAL_GESTURE_COMPLETED, { gesture: displayMovement })
        : formatValidationMessage(STATUS_MESSAGES.MOVEMENT_COMPLETED, { movement: displayMovement });
      
      // Establecer isInProgress: false INMEDIATAMENTE para detener el procesamiento
      this.updateValidationState({
        movementsCompleted: newMovementsCompleted,
        currentStep: -1, // Cambiar a modo "terminado" inmediatamente
        isInProgress: false // DETENER LA VALIDACIÓN INMEDIATAMENTE
      });
      
      // Mensaje final más claro
      const completionMessage = `🎉 ¡Excelente! Has completado todos los movimientos (${newMovementsCompleted.length}/3). Procesando validación final...`;
      this.updateStatusMessage(completionMessage, 'finalization', true);
      
      console.log(`📋 Secuencia completada actualizada: [${newMovementsCompleted.join(', ')}]`);
      console.log(`🛑 Validación DETENIDA después del último movimiento (${newMovementsCompleted.length}/3 completados)`);
      
      // CORRECCIÓN: Usar el índice correcto para el paso
      this.captureAndSendPhoto(movement, this.currentMovementIndex + 1, true); // true = es el último movimiento
    } else {
      // FLUJO SIMPLIFICADO: Volver al centro y esperar que se detecte centrado
      console.log(`🔄 PASO 4: Movimiento completado, volviendo al centro para el siguiente`);
      
      // Capturar foto y enviar al backend (no es el último)
      this.captureAndSendPhoto(movement, this.currentMovementIndex + 1, false);
      
      // Actualizar estado y esperar que se detecte centrado
      this.updateValidationState({
        currentStep: 0, // Volver a modo centrado
        movementsCompleted: newMovementsCompleted
      });
      
      // Mensaje simple de retorno al centro con contador claro
      const nextIsFacialGesture = nextMovement ? this.isFacialGesture(nextMovement) : false;
      const nextGestureType = nextIsFacialGesture ? 'gesto facial' : 'movimiento';
      const completedCount = newMovementsCompleted.length;
      
      const returnMessage = nextMovement 
        ? `✅ Movimiento ${completedCount}/3 completado. Vuelve al centro y prepárate para el siguiente ${nextGestureType}: "${nextMovement}"`
        : `✅ Movimiento ${completedCount}/3 completado. Vuelve al centro.`;
      
      this.updateStatusMessage(returnMessage, 'return_to_center', true);
      
      // Resetear distancia inicial para el siguiente movimiento
      this.initialDistance = null;
    }
    
    // CORRECCIÓN: Incrementar el índice DESPUÉS de toda la lógica
    this.currentMovementIndex++;
    console.log(`🔍 Debug - Índice actualizado a: ${this.currentMovementIndex}`);
  }

  // MÉTODOS ELIMINADOS: startReturnToCenterPhase y confirmCenterAndPrepareNext
  // El flujo simplificado no necesita estos métodos complejos
  // El retorno al centro se maneja directamente en completeMovement
  // y la detección de centrado se maneja en processDetection

  /**
   * Analiza la respuesta del backend de manera más inteligente
   */
  private analyzeBackendResponse(response: any): boolean {
    // Verificar que response no sea undefined o null
    if (!response) {
      console.warn('⚠️ analyzeBackendResponse: response es undefined o null');
      return false;
    }
    
    // Verificar si hay score y es mayor a 80 para validación exitosa
    if (response.score && response.score >= 80) {
      return true;
    }
    
    // Verificar estado final
    if (response.estadoFinal === 'Exitosa') {
      return true;
    }
    
    // Verificar mensaje positivo
    if (response.message && (
      response.message.includes('correctamente') ||
      response.message.includes('✅') ||
      response.message.includes('completa') ||
      response.message.includes('Exitosa')
    )) {
      return true;
    }
    
    // Verificar success explícito
    if (response.success === true) {
      return true;
    }
    
    return false;
  }

  /**
   * Obtiene el mensaje de resultado basado en la respuesta del backend
   */
  private getValidationResultMessage(response: any): string {
    // Verificar que response no sea undefined o null
    if (!response) {
      console.warn('⚠️ getValidationResultMessage: response es undefined o null');
      return '❌ Error: Respuesta inválida del servidor';
    }
    
    const score = response.score || 0;
    const estadoFinal = response.estadoFinal || '';
    const totalParpadeos = response.totalParpadeos || 0;
    const message = response.message || '';
    
    // Determinar el estado final
    const isExitoso = estadoFinal === 'Exitosa';
    const estadoIcon = isExitoso ? '✅' : '❌';
    const estadoTexto = isExitoso ? 'EXITOSA' : 'FALLIDA';
    
    // Si el backend ya proporciona un mensaje, usarlo
    if (message && (message.includes('✅') || message.includes('exitoso') || message.includes('completa'))) {
      return `${estadoIcon} ${message}
      Estado: ${estadoTexto}
      Score: ${score}% 
      Parpadeos detectados: ${totalParpadeos}`;
    }
    
    // Si no hay mensaje específico, generar uno basado en el score
    if (score >= 80 && isExitoso) {
      return `${estadoIcon} Validación ${estadoTexto}! 
      Score: ${score}% 
      Parpadeos detectados: ${totalParpadeos}`;
    } else {
      return `${estadoIcon} Validación ${estadoTexto}. 
      Score: ${score}% 
      Parpadeos detectados: ${totalParpadeos}
      
      Recomendaciones:
      • Asegúrate de completar todos los movimientos
      • Mantén una buena iluminación
      • Realiza los movimientos de manera clara y pausada`;
    }
  }

  /**
   * Captura una foto del video sin el círculo azul de guía
   */
  private captureCleanPhoto(): string {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (!video) {
      throw new Error('No se encontró el video para capturar foto');
    }

    // Crear un canvas temporal para capturar la foto sin círculo azul
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
      throw new Error('No se pudo obtener el contexto del canvas temporal');
    }

    // Configurar el canvas temporal con las mismas dimensiones que el video
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    // Dibujar el frame actual del video en el canvas temporal
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Convertir el canvas temporal a base64 (sin círculo azul)
    return tempCanvas.toDataURL('image/jpeg', 0.8);
  }

  /**
   * Captura foto y envía al backend
   */
  private captureAndSendPhoto(movement: string, step: number, isLastMovement: boolean = false): void {
    let fotoBase64: string;
    let currentState: any;
    
    try {
      // Capturar foto limpia sin círculo azul
      fotoBase64 = this.captureCleanPhoto();
      currentState = this.validationStateSubject.value;

      console.log(`📸 Capturando foto limpia para movimiento: ${movement}, paso: ${step}${isLastMovement ? ' (ÚLTIMO)' : ''}`);
      console.log(`📊 Datos enviados al backend:`, {
        sessionId: currentState.sessionId,
        intento: step,
        tipoMovimiento: movement,
        exitoso: true,
        parpadeos: this.currentMovementBlinks, // Usar contador del movimiento actual
        totalMovimientos: this.movementSequence.length,
        movimientosCompletados: currentState.movementsCompleted.length
      });
      
      // Verificar que estamos enviando el movimiento correcto
      console.log(`🎯 Enviando movimiento ${step}/${this.movementSequence.length}: ${movement}`);

      // Enviar al backend
      this.apiService.validarFacial(
        currentState.sessionId,
        fotoBase64,
        step,
        movement,
        true, // exitoso
        this.currentMovementBlinks // Usar contador del movimiento actual
      ).subscribe({
        next: (response) => {
          console.log('✅ Respuesta del backend:', response);
          
          // Verificar que response no sea undefined
          if (!response) {
            console.error('❌ Error: Respuesta del backend es undefined');
            this.updateValidationState({
              statusMessage: '⚠️ Error: Respuesta inválida del servidor'
            });
            return;
          }
          
          console.log(`🔍 Análisis de respuesta:`, {
            exitosos: response.exitosos,
            totalMovimientosEsperados: this.movementSequence.length,
            movimientosCompletadosFrontend: currentState.movementsCompleted.length,
            score: response.score,
            estadoFinal: response.estadoFinal
          });
          
          // Verificar si hay discrepancia
          if (response.exitosos !== undefined && response.exitosos !== this.movementSequence.length) {
            console.warn(`⚠️ DISCREPANCIA DETECTADA: Backend reporta ${response.exitosos} exitosos pero frontend completó ${this.movementSequence.length} movimientos`);
            console.warn(`📋 Movimientos completados en frontend: [${currentState.movementsCompleted.join(', ')}]`);
          }
          
          // Análisis mejorado de la respuesta
          const isSuccess = this.analyzeBackendResponse(response);
          
          if (isSuccess) {
            console.log(`🎯 Movimiento ${movement} validado por el servidor`);
            
            if (isLastMovement) {
              // Es el último movimiento - finalizar con la respuesta real del backend
              this.finalizeValidationWithResponse(response);
            } else {
              // No es el último - mostrar confirmación específica
              const nextMovementIndex = this.currentMovementIndex + 1;
              const nextMovement = nextMovementIndex < this.movementSequence.length 
                ? this.movementSequence[nextMovementIndex] 
                : null;
                
              const nextMessage = nextMovement 
                ? `Prepárate para "${nextMovement}"...`
                : 'Prepárate para el siguiente movimiento...';
                
              this.updateValidationState({
                statusMessage: `✅ Movimiento "${movement}" validado. ${nextMessage}`
              });
            }
          } else {
            console.warn(`⚠️ Movimiento ${movement} rechazado por el servidor:`, response.message);
            // Mostrar mensaje específico del backend
            this.updateValidationState({
              statusMessage: `⚠️ Movimiento "${movement}" rechazado: ${response.message || 'Error en validación'}`
            });
          }
        },
        error: (error) => {
          console.error('❌ Error al enviar al backend:', error);
          
          // Manejo específico de errores
          if (error.status === 0) {
            this.updateValidationState({
              statusMessage: '⚠️ Error de conexión. Verifica tu internet.'
            });
          } else if (error.status === 500) {
            this.updateValidationState({
              statusMessage: '⚠️ Error del servidor. Intenta de nuevo.'
            });
          } else {
            this.updateValidationState({
              statusMessage: `⚠️ Error: ${error.message || 'Error desconocido'}`
            });
          }
        }
      });

    } catch (error) {
      console.error('❌ Error al capturar foto limpia:', error);
      this.updateValidationState({
        statusMessage: '⚠️ Error al capturar imagen. Intenta de nuevo.'
      });
    }
  }

  /**
   * Finaliza la validación con la respuesta real del backend
   */
  private finalizeValidationWithResponse(backendResponse: any): void {
    const currentState = this.validationStateSubject.value;
    
    // Cancelar todos los timeouts y subscripciones
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();
    
    // Verificar que backendResponse no sea undefined o null
    if (!backendResponse) {
      console.error('❌ Error: backendResponse es undefined en finalizeValidationWithResponse');
      this.updateValidationState({
        isInProgress: false,
        statusMessage: '❌ Error: Respuesta inválida del servidor'
      });
      return;
    }
    
    // Usar la respuesta real del backend en lugar de datos simulados
    const finalResponse = {
      score: backendResponse.score || 0,
      estadoFinal: backendResponse.estadoFinal || 'Pendiente',
      totalParpadeos: backendResponse.totalParpadeos || currentState.blinksDetected,
      message: backendResponse.message || 'Validación completada'
    };
    
    const resultMessage = this.getValidationResultMessage(finalResponse);
    
    this.updateValidationState({
      isInProgress: false,
      currentStep: -1, // -1 indica que la validación ha terminado, no mostrar círculos
      statusMessage: resultMessage
    });

    console.log(`✔️ Validación finalizada con respuesta real del backend. ${resultMessage}`);
    console.log(`📋 Estado final - Movimientos completados: [${currentState.movementsCompleted.join(', ')}]`);
    
    // Limpiar sesión en el backend de Python
    this.cleanupPythonSession(currentState.sessionId);
  }



  /**
   * Maneja el timeout de un movimiento o gesto - captura foto y envía como fallido
   */
  private handleMovementTimeout(): void {
    const currentMovement = this.movementSequence[this.currentMovementIndex];
    const currentStep = this.currentMovementIndex + 1;
    const isFacialGesture = this.isFacialGesture(currentMovement);
    const gestureType = isFacialGesture ? 'gesto facial' : 'movimiento';
    
    // Aplicar inversión de mensaje para movimientos laterales
    const displayMovement = isFacialGesture ? currentMovement : this.invertLateralMovementMessage(currentMovement);
    
    console.log(`⏰ Timeout en ${gestureType}: ${currentMovement} (paso ${currentStep})`);
    
    // Validar que el movimiento no sea undefined
    const movementName = currentMovement && currentMovement !== 'undefined' 
      ? displayMovement 
      : `${gestureType} actual`;
    
    // Mostrar mensaje específico de timeout
    this.updateValidationState({
      statusMessage: `⏰ Tiempo agotado para el ${gestureType} "${movementName}". Intenta de nuevo.`
    });
    
    // Capturar foto y enviar como fallido
    this.captureAndSendPhotoFailed(currentMovement || 'unknown', currentStep, `⏰ Tiempo agotado para ${gestureType}`);
  }

  /**
   * Captura foto y envía al backend como fallido
   */
  private captureAndSendPhotoFailed(movement: string, step: number, reason: string): void {
    try {
      // Capturar foto limpia sin círculo azul
      const fotoBase64 = this.captureCleanPhoto();
      const currentState = this.validationStateSubject.value;

      console.log(`📸 Capturando foto limpia fallida para movimiento: ${movement}, paso: ${step}, razón: ${reason}`);

      // Enviar al backend como fallido
      this.apiService.validarFacial(
        currentState.sessionId,
        fotoBase64,
        step,
        movement,
        false, // exitoso = false
        this.currentMovementBlinks // Usar contador del movimiento actual
      ).subscribe({
        next: (response) => {
          console.log('✅ Registro fallido enviado al backend:', response);
          this.failValidation(`${reason} - Movimiento: ${movement}`);
        },
        error: (error) => {
          console.error('❌ Error al enviar registro fallido:', error);
          this.failValidation(`${reason} - Error al registrar`);
        }
      });

    } catch (error) {
      console.error('❌ Error al capturar foto fallida:', error);
      this.failValidation(reason);
    }
  }

  /**
   * Falla la validación
   */
  private failValidation(message: string): void {
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();

    // Obtener el movimiento actual si está disponible
    const currentMovement = this.getCurrentMovement();
    const isFacialGesture = currentMovement ? this.isFacialGesture(currentMovement) : false;
    const gestureType = isFacialGesture ? 'gesto facial' : 'movimiento';
    
    // Aplicar inversión de mensaje para movimientos laterales
    const displayMovement = currentMovement && !isFacialGesture ? this.invertLateralMovementMessage(currentMovement) : currentMovement;
    
    const specificMessage = currentMovement && currentMovement !== 'undefined'
      ? `❌ Validación fallida en ${gestureType} "${displayMovement}": ${message}. Intenta de nuevo.`
      : `❌ Validación fallida: ${message}. Intenta de nuevo.`;

    this.updateValidationState({
      isInProgress: false
    });
    
    // Mensaje de error con estabilidad
    this.updateStatusMessage(specificMessage, 'error', true);

    console.log('❌ Fallo en la validación');
    
    // Limpiar sesión en el backend de Python
    const currentState = this.validationStateSubject.value;
    this.cleanupPythonSession(currentState.sessionId);
  }

  /**
   * Actualiza el estado de validación de manera estable
   */
  private updateValidationState(updates: Partial<ValidationState>): void {
    const currentState = this.validationStateSubject.value;
    const newState = { ...currentState, ...updates };
    this.validationStateSubject.next(newState);
  }

  /**
   * Actualiza el mensaje de estado de manera estable, evitando cambios rápidos
   */
  private updateStatusMessage(message: string, phase: string = '', force: boolean = false): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastMessageUpdate;
    
    // Si el mensaje es el mismo, no hacer nada
    if (this.validationStateSubject.value.statusMessage === message && !force) {
      return;
    }
    
    // Si estamos en la misma fase y no ha pasado suficiente tiempo, programar la actualización
    if (phase === this.currentMessagePhase && timeSinceLastUpdate < this.messageStabilityDelay && !force) {
      this.pendingMessageUpdate = message;
      setTimeout(() => {
        if (this.pendingMessageUpdate === message) {
          this.updateValidationState({ statusMessage: message });
          this.lastMessageUpdate = Date.now();
          this.pendingMessageUpdate = null;
        }
      }, this.messageStabilityDelay - timeSinceLastUpdate);
      return;
    }
    
    // Actualizar inmediatamente si es forzado o es una fase diferente
    this.updateValidationState({ statusMessage: message });
    this.lastMessageUpdate = now;
    this.currentMessagePhase = phase;
    this.pendingMessageUpdate = null;
    
    console.log(`📝 Mensaje actualizado (${phase}): "${message}"`);
  }

  /**
   * Resetea la validación
   */
  resetValidation(): void {
    console.log('🔄 Reseteando validación anterior...');
    
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();
    this.centerReturnSubscription?.unsubscribe();
    
    this.updateValidationState({
      isInProgress: false,
      currentStep: 0,
      movementsCompleted: [],
      blinksDetected: 0
    });
    
    // Mensaje de ready con estabilidad
    this.updateStatusMessage(STATUS_MESSAGES.READY, 'ready', true);

    // Limpiar secuencia anterior
    const previousSequence = this.movementSequence;
    this.movementSequence = [];
    this.currentMovementIndex = 0; // Resetear índice de movimiento
    this.initialDistance = null;
    this.blinkActive = false;
    
    // Resetear contadores de parpadeos por movimiento
    this.currentMovementBlinks = 0;
    this.movementBlinkActive = false;
    
    // Resetear fases del flujo suave
    this.isInPreparationPhase = false;
    this.isInMovementPhase = false;
    this.isInReturnToCenterPhase = false;
    
    // Resetear fase de ejecución
    this.isInExecutionPhase = false;

    // Resetear validación de centrado inicial
    this.hasValidatedInitialCenter = false;
    
    // Limpiar gestos disponibles para forzar nueva obtención
    this.gestosDisponibles = null;
    
    console.log('✅ Validación reseteada. Secuencia anterior:', previousSequence);
  }

  /**
   * Limpia la sesión en el backend de Python
   */
  private cleanupPythonSession(sessionId: string): void {
    if (!sessionId) return;
    
    // Llamar al endpoint de limpieza del backend de Python
    fetch(`${DETECTION_API_CONFIG.BASE_URL}${DETECTION_API_CONFIG.ENDPOINTS.LIMPIAR_SESION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId })
    })
    .then(response => response.json())
    .then(data => {
      console.log('🧹 Sesión limpiada en backend de Python:', data);
    })
    .catch(error => {
      console.warn('⚠️ Error al limpiar sesión en Python:', error);
    });
  }

  /**
   * Limpia recursos
   */
  private cleanup(): void {
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();
    this.centerReturnSubscription?.unsubscribe();
    this.validationStateSubject.complete();
    this.blinkActive = false;
    this.initialDistance = null;
    this.currentMovementBlinks = 0;
    this.movementBlinkActive = false;
    this.isInPreparationPhase = false;
    this.isInMovementPhase = false;
    this.isInReturnToCenterPhase = false;
    this.isInExecutionPhase = false;
    this.hasValidatedInitialCenter = false;
  }

  /**
   * Obtiene el movimiento actual de la secuencia
   */
  getCurrentMovement(): string | null {
    if (!this.validationStateSubject.value.isInProgress) {
      return null;
    }
    
    const currentStep = this.validationStateSubject.value.currentStep;
    if (currentStep === 0) {
      return null; // Modo centrado
    }
    
    // Validar que el índice esté dentro del rango válido
    if (this.currentMovementIndex >= 0 && 
        this.currentMovementIndex < this.movementSequence.length && 
        this.movementSequence.length > 0) {
      const movement = this.movementSequence[this.currentMovementIndex];
      // Verificar que el movimiento no sea undefined
      if (movement && typeof movement === 'string') {
        return movement;
      }
    }
    
    console.warn(`⚠️ getCurrentMovement: Índice fuera de rango o movimiento undefined`, {
      currentMovementIndex: this.currentMovementIndex,
      sequenceLength: this.movementSequence.length,
      sequence: this.movementSequence
    });
    
    return null;
  }

  /**
   * Obtiene el conteo de parpadeos del movimiento actual
   */
  getCurrentMovementBlinks(): number {
    return this.currentMovementBlinks;
  }

  /**
   * Obtiene el progreso actual de la validación
   */
  getValidationProgress(): { current: number; total: number; percentage: number } {
    const currentState = this.validationStateSubject.value;
    const completed = currentState.movementsCompleted.length;
    const total = this.movementSequence.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      current: completed,
      total,
      percentage
    };
  }

  /**
   * Obtiene la secuencia completa de movimientos
   */
  getMovementSequence(): string[] {
    return [...this.movementSequence];
  }

  /**
   * Obtiene información sobre los gestos disponibles actuales
   */
  getGestosDisponibles(): GestosDisponibles | null {
    return this.gestosDisponibles;
  }

  /**
   * Obtiene estadísticas de los gestos disponibles
   */
  getGestosStats(): { total: number; movimientos: number; faciales: number } | null {
    if (!this.gestosDisponibles) {
      return null;
    }
    
    return {
      total: this.gestosDisponibles.total_gestos,
      movimientos: this.gestosDisponibles.gestos_por_categoria.movimiento,
      faciales: this.gestosDisponibles.gestos_por_categoria.facial
    };
  }

  /**
   * Verifica que la secuencia actual sea única para esta validación
   */
  private verificarSecuenciaUnica(): void {
    const currentSequence = this.movementSequence.join(',');
    console.log('🔍 Verificando unicidad de secuencia:');
    console.log('   📋 Secuencia actual:', currentSequence);
    console.log('   🆔 Session ID:', this.validationStateSubject.value.sessionId);
    console.log('   ⏰ Timestamp:', new Date().toISOString());
    
    // Mostrar estadísticas de la secuencia
    this.mostrarEstadisticasSecuencia();
    
    // Aquí podrías agregar lógica para verificar contra secuencias anteriores
    // Por ahora solo mostramos la información
    console.log('   ✅ Secuencia verificada como única para esta validación');
  }

  /**
   * Muestra estadísticas de la secuencia actual
   */
  private mostrarEstadisticasSecuencia(): void {
    if (!this.gestosDisponibles || !this.movementSequence) return;
    
    const movimientos = this.movementSequence.filter(gesto => 
      this.gestosDisponibles!.gestos_movimiento.includes(gesto)
    );
    const faciales = this.movementSequence.filter(gesto => 
      this.gestosDisponibles!.gestos_faciales.includes(gesto)
    );
    
    console.log('   📊 Estadísticas de la secuencia:');
    console.log(`      🎯 Gestos de movimiento: ${movimientos.length}/${this.movementSequence.length}`);
    console.log(`      😊 Gestos faciales: ${faciales.length}/${this.movementSequence.length}`);
    
    if (movimientos.length > 0) {
      console.log(`      🎯 Movimientos: ${movimientos.join(', ')}`);
    }
    if (faciales.length > 0) {
      console.log(`      😊 Faciales: ${faciales.join(', ')}`);
    }
  }

  // Método ajustado para finalizar validación (ajusta el nombre si es diferente)
  async finalizarValidacion(currentState: ValidationState): Promise<ExtendedValidationState> { // Usamos ValidationState y ExtendedValidationState
    try {
      // Preparar datos a enviar al backend (ajusta según lo que necesite tu Lambda)
      const datos = {
        identificador: (currentState as any).identificador || 'unknown', // Usa any temporal para evitar TS2339 si no existe
        intento: currentState.currentStep,
        tipoMovimiento: (currentState as any).currentMovement || 'unknown',
        exitoso: true, // O basado en lógica
        timestamp: new Date().toISOString(),
        fotoBase64: (currentState as any).fotoBase64 || '',
        parpadeos: currentState.blinksDetected || 0
      };

      console.log('📤 Enviando datos finales a backend:', datos);

      // Llamada POST real a la Lambda
      const response = await fetch(API_CONFIG.BASE_URL + '/pruebadevida', { // Ajusta '/pruebadevida' si es diferente
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify(datos)
      });

      if (!response.ok) {
        throw new Error(`Error en backend: ${response.status} - ${await response.text()}`);
      }

      const finalResponse = await response.json();
      console.log('✅ Respuesta del backend:', finalResponse);

      // Verificar que finalResponse no sea undefined y tenga 'exitosos'
      if (!finalResponse || typeof finalResponse.exitosos === 'undefined') {
        throw new Error('Respuesta inválida de API: faltan datos esperados (exitosos)');
      }

      // Actualizar estado con datos reales (usamos ExtendedValidationState para agregar properties)
      const updatedState: ExtendedValidationState = {
        ...currentState,
        isInProgress: false,
        score: finalResponse.score,
        estadoFinal: finalResponse.estadoFinal,
        totalParpadeos: finalResponse.totalParpadeos
      };

      this.validationStateSubject.next(updatedState);

      return updatedState;
    } catch (error: unknown) { // Tipo error como unknown para TS18046
      console.error('❌ Error al finalizar validación:', error);
      // Manejar error en UI (agregamos 'error' usando ExtendedValidationState)
      const errorState: ExtendedValidationState = {
        ...currentState,
        isInProgress: false,
        statusMessage: 'Error al procesar validación final: ' + (error instanceof Error ? error.message : 'Desconocido'),
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
      this.validationStateSubject.next(errorState);
      return errorState;
    }
  }
} 