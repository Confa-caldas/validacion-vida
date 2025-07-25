import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, timer, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { FaceDetectionService } from '../../../core/services/face-detection.service';
import { CameraService } from '../../../core/services/camera.service';
import { ValidationState, ValidationResponse } from '../../../core/models';
import { ValidationUtils } from '../../../shared/utils/validation.utils';
import { FaceDetectionUtils } from '../../../shared/utils/face-detection.utils';
import { STATUS_MESSAGES } from '../../../config/constants';
import { VALIDATION_CONFIG } from '../../../config/api.config';
import { API_CONFIG } from '../../../config/api.config';

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
      // Generar nueva sesión
      const sessionId = ValidationUtils.generateSessionId();
      this.movementSequence = ValidationUtils.generateRandomMovementSequence();
      this.currentMovementIndex = 0; // Resetear índice de movimiento
      
      // Validar que la secuencia se generó correctamente
      if (!this.movementSequence || this.movementSequence.length === 0) {
        throw new Error('No se pudo generar la secuencia de movimientos');
      }
      
      console.log('🆔 Sesión de validación:', sessionId);
      console.log('🎲 Secuencia generada:', this.movementSequence);
      console.log('📊 Longitud de secuencia:', this.movementSequence.length);
      
      // Actualizar estado
      this.updateValidationState({
        isInProgress: true,
        sessionId,
        currentStep: 0,
        movementsCompleted: [],
        blinksDetected: 0,
        statusMessage: STATUS_MESSAGES.PREPARING
      });

      // Cargar modelo si no está cargado
      if (!this.faceDetectionService.isModelReady()) {
        await this.faceDetectionService.loadModel();
      }

      this.updateValidationState({
        statusMessage: STATUS_MESSAGES.CENTER_FACE
      });

    } catch (error) {
      console.error('❌ Error al iniciar validación:', error);
      this.failValidation(`Error al iniciar: ${error}`);
    }
  }

  /**
   * Procesa la detección facial y actualiza el estado
   */
  processDetection(detectionResult: any): void {
    if (!this.validationStateSubject.value.isInProgress) return;

    const currentState = this.validationStateSubject.value;
    
    // No procesar más detecciones si la validación ya terminó
    if (currentState.currentStep === -1) return;

    // Verificar parpadeo
    this.checkBlink(detectionResult);
    
    if (currentState.currentStep === 0 && detectionResult.isCentered) {
      // Rostro centrado, preparar siguiente movimiento
      this.prepareNextMovement();
    } else if (currentState.currentStep > 0) {
      // Verificar movimiento actual
      const currentMovement = this.movementSequence[this.currentMovementIndex];
      if (currentMovement) {
        this.checkMovement(detectionResult, currentMovement);
      }
    }
  }

  /**
   * Verifica si se detectó un parpadeo
   */
  private checkBlink(detectionResult: any): void {
    if (detectionResult.blinkDetected && !this.blinkActive) {
      this.blinkActive = true;
      const currentState = this.validationStateSubject.value;
      const newBlinksDetected = currentState.blinksDetected + 1;
      
      this.updateValidationState({
        blinksDetected: newBlinksDetected
      });

      console.log(`👁️‍🗨️ Parpadeo detectado (${newBlinksDetected}/${currentState.requiredBlinks})`);
    } else if (!detectionResult.blinkDetected) {
      this.blinkActive = false;
    }
  }

  /**
   * Prepara el siguiente movimiento en la secuencia
   */
  private prepareNextMovement(): void {
    const movement = this.movementSequence[this.currentMovementIndex];
    
    console.log(`🎯 Preparando movimiento: ${movement} (índice: ${this.currentMovementIndex})`);
    
    this.updateValidationState({
      currentStep: 1, // Cambiar a modo validación
      statusMessage: ValidationUtils.formatStatusMessage(
        STATUS_MESSAGES.PREPARE_MOVEMENT, 
        { movement }
      )
    });

    // Contador de preparación
    let countdown = VALIDATION_CONFIG.PREPARATION_COUNTDOWN;
    this.preparationSubscription = timer(0, 1000).subscribe(() => {
      if (countdown <= 0) {
        this.startMovementValidation();
        this.preparationSubscription?.unsubscribe();
      } else {
        this.updateValidationState({
          statusMessage: `Prepárate para "${movement}" en ${countdown}...`
        });
        countdown--;
      }
    });
  }

  /**
   * Inicia la validación del movimiento actual
   */
  private startMovementValidation(): void {
    const movement = this.movementSequence[this.currentMovementIndex];
    
    console.log(`🎯 Iniciando validación del movimiento: ${movement}`);

    this.updateValidationState({
      statusMessage: `Realiza el movimiento: "${movement}"`
    });

    // Timeout para el movimiento
    this.timeoutSubscription = timer(VALIDATION_CONFIG.MOVEMENT_TIMEOUT).subscribe(() => {
      this.handleMovementTimeout();
    });
  }

  /**
   * Verifica si se completó el movimiento actual
   */
  private checkMovement(detectionResult: any, movement: string): void {
    // Para el movimiento de acercarse, necesitamos guardar la distancia inicial
    if (movement === 'acercarse' && this.initialDistance === null) {
      this.initialDistance = detectionResult.distanceBetweenEyes;
      console.log('📏 Distancia inicial guardada:', this.initialDistance);
    }

    const isMovementDetected = FaceDetectionUtils.detectMovement(
      detectionResult.faceLandmarks.landmarks, 
      movement, 
      this.initialDistance || undefined
    );

    // Obtener información de debug para mejor feedback
    const debugInfo = FaceDetectionUtils.getMovementDebugInfo(
      detectionResult.faceLandmarks.landmarks,
      movement,
      this.initialDistance || undefined
    );

    if (isMovementDetected) {
      console.log(`🎯 Movimiento "${movement}" detectado correctamente:`, debugInfo);
      this.completeMovement(movement);
    } else {
      // Mostrar información de progreso cada 2 segundos para ayudar al usuario
      const currentTime = Date.now();
      if (!this.lastDebugTime || currentTime - this.lastDebugTime > 2000) {
        console.log(`📊 Progreso del movimiento "${movement}":`, debugInfo);
        this.lastDebugTime = currentTime;
      }
    }
  }

  /**
   * Completa un movimiento y prepara el siguiente
   */
  private completeMovement(movement: string): void {
    this.timeoutSubscription?.unsubscribe();
    
    const currentState = this.validationStateSubject.value;
    const newMovementsCompleted = [...currentState.movementsCompleted, movement];

    console.log(`✅ Movimiento "${movement}" detectado correctamente`);

    // Obtener el siguiente movimiento antes de incrementar el índice
    const nextMovementIndex = this.currentMovementIndex + 1;
    const nextMovement = nextMovementIndex < this.movementSequence.length 
      ? this.movementSequence[nextMovementIndex] 
      : null;
    
    // Incrementar el índice del movimiento
    this.currentMovementIndex++;

    if (this.currentMovementIndex >= this.movementSequence.length) {
      // Último movimiento completado - capturar foto y esperar respuesta del backend
      this.updateValidationState({
        movementsCompleted: newMovementsCompleted,
        currentStep: -1, // Cambiar a modo "terminado" inmediatamente
        statusMessage: `✅ Movimiento "${movement}" completado. Procesando validación final...`
      });
      
      console.log(`📋 Movimientos completados actualizados: [${newMovementsCompleted.join(', ')}]`);
      
      this.captureAndSendPhoto(movement, this.currentMovementIndex, true); // true = es el último movimiento
    } else {
      // Capturar foto y enviar al backend (no es el último)
      this.captureAndSendPhoto(movement, this.currentMovementIndex, false);
      
      // Mostrar mensaje específico con el movimiento completado y el siguiente
      const nextMessage = nextMovement 
        ? `Prepárate para "${nextMovement}"...`
        : 'Prepárate para el siguiente movimiento...';
        
      this.updateValidationState({
        currentStep: 0, // Volver a modo centrado
        movementsCompleted: newMovementsCompleted,
        statusMessage: `✅ Movimiento "${movement}" completado. ${nextMessage}`
      });
      
      // Resetear distancia inicial para el siguiente movimiento
      this.initialDistance = null;
      
      // Después de 2 segundos, mostrar mensaje de centrado
      setTimeout(() => {
        this.updateValidationState({
          statusMessage: STATUS_MESSAGES.CENTER_CONTINUE
        });
      }, 2000);
    }
  }

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
        parpadeos: currentState.blinksDetected,
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
        currentState.blinksDetected
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
  }



  /**
   * Maneja el timeout de un movimiento - captura foto y envía como fallido
   */
  private handleMovementTimeout(): void {
    const currentMovement = this.movementSequence[this.currentMovementIndex];
    const currentStep = this.currentMovementIndex + 1;
    
    console.log(`⏰ Timeout en movimiento: ${currentMovement} (paso ${currentStep})`);
    
    // Validar que el movimiento no sea undefined
    const movementName = currentMovement && currentMovement !== 'undefined' 
      ? currentMovement 
      : 'movimiento actual';
    
    // Mostrar mensaje específico de timeout
    this.updateValidationState({
      statusMessage: `⏰ Tiempo agotado para el movimiento "${movementName}". Intenta de nuevo.`
    });
    
    // Capturar foto y enviar como fallido
    this.captureAndSendPhotoFailed(currentMovement || 'unknown', currentStep, '⏰ Tiempo agotado');
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
        currentState.blinksDetected
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
    const specificMessage = currentMovement && currentMovement !== 'undefined'
      ? `❌ Validación fallida en movimiento "${currentMovement}": ${message}. Intenta de nuevo.`
      : `❌ Validación fallida: ${message}. Intenta de nuevo.`;

    this.updateValidationState({
      isInProgress: false,
      statusMessage: specificMessage
    });

    console.log('❌ Fallo en la validación');
  }

  /**
   * Actualiza el estado de validación
   */
  private updateValidationState(updates: Partial<ValidationState>): void {
    const currentState = this.validationStateSubject.value;
    this.validationStateSubject.next({ ...currentState, ...updates });
  }

  /**
   * Resetea la validación
   */
  resetValidation(): void {
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();
    
    this.updateValidationState({
      isInProgress: false,
      currentStep: 0,
      movementsCompleted: [],
      blinksDetected: 0,
      statusMessage: STATUS_MESSAGES.READY
    });

    this.movementSequence = [];
    this.currentMovementIndex = 0; // Resetear índice de movimiento
    this.initialDistance = null;
    this.blinkActive = false;
  }

  /**
   * Limpia recursos
   */
  private cleanup(): void {
    this.timeoutSubscription?.unsubscribe();
    this.preparationSubscription?.unsubscribe();
    this.validationStateSubject.complete();
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