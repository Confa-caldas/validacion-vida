import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LivenessDetectionService } from '../services/liveness-detection.service';
import { FaceDetectionService } from '../../../core/services/face-detection.service';
import { CameraService } from '../../../core/services/camera.service';
import { CanvasUtils } from '../../../shared/utils/canvas.utils';
import { ValidationState } from '../../../core/models';

@Component({
  selector: 'app-liveness-detection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './liveness-detection.component.html',
  styleUrls: ['./liveness-detection.component.css']
})
export class LivenessDetectionComponent implements OnInit, OnDestroy {
  
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  // Elementos del DOM
  video!: HTMLVideoElement;
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  // Estado de la aplicación
  validationState: ValidationState | null = null;
  isCameraActive = false;
  isModelLoaded = false;
  isWaitingForResult = false;

  // Subscripciones
  private validationSubscription?: Subscription;
  private detectionSubscription?: Subscription;
  private cameraSubscription?: Subscription;
  private animationFrameId?: number;

  constructor(
    private livenessService: LivenessDetectionService,
    private faceDetectionService: FaceDetectionService,
    private cameraService: CameraService
  ) { }

  ngOnInit(): void {
    this.setupSubscriptions();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Configura las subscripciones a los observables
   */
  private setupSubscriptions(): void {
    // Subscripción al estado de validación
    this.validationSubscription = this.livenessService.validationState$.subscribe(
      state => {
        this.validationState = state;
        console.log('🔄 Estado de validación actualizado:', state);
      }
    );

    // Subscripción a la detección facial
    this.detectionSubscription = this.faceDetectionService.detection$.subscribe(
      detection => {
        if (detection) {
          this.livenessService.processDetection(detection);
        }
      }
    );

    // Subscripción al estado de la cámara
    this.cameraSubscription = this.cameraService.isActive$.subscribe(
      isActive => {
        this.isCameraActive = isActive;
      }
    );
  }

  /**
   * Inicia la cámara
   */
  async startCamera(): Promise<void> {
    try {
      this.video = this.videoRef.nativeElement;
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d')!;

      const stream = await this.cameraService.startCamera();
      this.video.srcObject = stream;
      await this.video.play();

      this.video.onloadedmetadata = () => {
        this.resizeCanvas();
      };

      await this.loadModel();
      this.startVideoProcessing();

    } catch (error) {
      console.error('❌ Error al iniciar cámara:', error);
      alert(`Error al iniciar cámara: ${error}`);
    }
  }

  /**
   * Detiene la cámara
   */
  stopCamera(): void {
    this.cameraService.stopCamera();
    this.stopVideoProcessing();
  }

  /**
   * Carga el modelo de detección facial
   */
  private async loadModel(): Promise<void> {
    try {
      await this.faceDetectionService.loadModel();
      this.isModelLoaded = true;
      console.log('✅ Modelo cargado correctamente');
    } catch (error) {
      console.error('❌ Error al cargar modelo:', error);
      throw error;
    }
  }

  /**
   * Inicia el procesamiento de video
   */
  private startVideoProcessing(): void {
    const processFrame = () => {
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.processVideoFrame();
      }
      this.animationFrameId = requestAnimationFrame(processFrame);
    };
    processFrame();
  }

  /**
   * Detiene el procesamiento de video
   */
  private stopVideoProcessing(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  /**
   * Procesa un frame de video
   */
  private processVideoFrame(): void {
    // Configurar canvas
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

    // Dibujar guía visual
    this.drawVisualGuide();

    // Procesar detección facial
    const detectionResult = this.faceDetectionService.processVideoFrame(this.video);
    if (detectionResult) {
      // Pasar directamente al servicio de liveness detection
      this.livenessService.processDetection(detectionResult);
    }
  }

  /**
   * Dibuja la guía visual en el canvas
   */
  private drawVisualGuide(): void {
    if (!this.validationState) return;

    // No dibujar guías si la validación ha terminado (currentStep = -1)
    if (this.validationState.currentStep === -1) return;

    const isCenteringMode = this.validationState.currentStep === 0;
    const currentMovement = this.validationState.currentStep > 0 
      ? this.getCurrentMovement() 
      : null;

    CanvasUtils.drawVisualGuide(
      this.ctx,
      this.canvas,
      currentMovement,
      isCenteringMode
    );
  }

  /**
   * Obtiene el movimiento actual
   */
  getCurrentMovement(): string | null {
    return this.livenessService.getCurrentMovement();
  }

  /**
   * Obtiene el paso actual para mostrar
   */
  getCurrentStepDisplay(): number {
    if (!this.validationState) return 0;
    
    // Si está en modo centrado (currentStep = 0), mostrar el siguiente paso
    if (this.validationState.currentStep === 0) {
      return this.validationState.movementsCompleted.length + 1;
    }
    
    // Si está en modo validación, mostrar el paso actual
    return this.validationState.currentStep;
  }

  /**
   * Inicia la validación
   */
  async startValidation(): Promise<void> {
    try {
      await this.livenessService.startValidation();
    } catch (error) {
      console.error('❌ Error al iniciar validación:', error);
      alert(`Error al iniciar validación: ${error}`);
    }
  }

  /**
   * Redimensiona el canvas
   */
  private resizeCanvas(): void {
    if (this.canvas && this.video) {
      CanvasUtils.resizeCanvas(this.canvas, this.video);
    }
  }

  /**
   * Limpia recursos
   */
  private cleanup(): void {
    this.validationSubscription?.unsubscribe();
    this.detectionSubscription?.unsubscribe();
    this.cameraSubscription?.unsubscribe();
    this.stopVideoProcessing();
    this.cameraService.stopCamera();
    window.removeEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Obtiene el mensaje de estado actual
   */
  get statusMessage(): string {
    if (!this.validationState) return '';
    
    // Solo mostrar el mensaje del estado, sin información de pasos
    return this.validationState.statusMessage;
  }

  /**
   * Verifica si la validación está en progreso
   */
  get isValidationInProgress(): boolean {
    return !!(this.validationState && this.validationState.isInProgress && this.validationState.currentStep > 0);
  }

  get isValidationSuccessful(): boolean {
    if (!this.validationState) return false;
    return !this.validationState.isInProgress && 
           this.validationState.statusMessage.includes('¡Validación exitosa!');
  }

  get isValidationFailed(): boolean {
    if (!this.validationState) return false;
    return !this.validationState.isInProgress && 
           this.validationState.statusMessage.includes('Validación no exitosa');
  }
} 