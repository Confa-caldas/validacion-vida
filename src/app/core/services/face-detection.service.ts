import { Injectable, OnDestroy } from '@angular/core';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { BehaviorSubject, Observable } from 'rxjs';
import { FaceLandmark, FaceDetectionResult } from '../models';
import { FaceDetectionUtils } from '../../shared/utils/face-detection.utils';
import { MEDIAPIPE_CONFIG, getMediaPipeAssetPath } from '../../config/constants';

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService implements OnDestroy {
  
  private faceLandmarker!: FaceLandmarker;
  private isModelLoaded = false;
  private detectionSubject = new BehaviorSubject<FaceDetectionResult | null>(null);
  
  public detection$ = this.detectionSubject.asObservable();

  constructor() { }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Verifica que el archivo WASM esté disponible
   */
  private async verifyWasmAsset(): Promise<void> {
    const wasmUrl = getMediaPipeAssetPath(MEDIAPIPE_CONFIG.WASM_FILE);
    
    console.log('🔍 Verificando archivo WASM...');
    
    try {
      const response = await fetch(wasmUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Archivo WASM no disponible: ${response.status}`);
      }
      console.log(`✅ WASM - Disponible en: ${wasmUrl}`);
    } catch (error) {
      console.error(`❌ WASM - Error:`, error);
      throw new Error(`No se puede acceder al archivo WASM: ${wasmUrl}`);
    }
  }

  /**
   * Carga el modelo de MediaPipe
   */
  async loadModel(): Promise<void> {
    try {
      console.log('🔄 Iniciando carga del modelo...');
      
      // Verificar que el archivo WASM esté disponible
      await this.verifyWasmAsset();
      
      // Cargar WASM desde CDN oficial de MediaPipe
      const wasmUrl = getMediaPipeAssetPath(MEDIAPIPE_CONFIG.WASM_FILE);
      console.log('📁 Cargando WASM desde CDN oficial:', wasmUrl);
      
      // Monkey patch: establecer la URL del WASM globalmente
      (globalThis as any).wasmBinary = wasmUrl;

      console.log('🔄 Cargando FilesetResolver...');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CONFIG.BASE_PATH);
      console.log('✅ FilesetResolver cargado correctamente');

      console.log('🔄 Creando FaceLandmarker...');
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: getMediaPipeAssetPath(MEDIAPIPE_CONFIG.FACE_LANDMARKER_TASK)
        },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true
      });

      this.isModelLoaded = true;
      console.log('✅ Modelo de detección facial cargado correctamente');
    } catch (error) {
      console.error('❌ Error al cargar el modelo:', error);
      console.error('❌ Detalles del error:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        constructor: error?.constructor?.name || 'Unknown'
      });
      
      // Información adicional para debug
      console.error('🔍 Información de debug:');
      console.error('  - URL del WASM:', getMediaPipeAssetPath(MEDIAPIPE_CONFIG.WASM_FILE));
      console.error('  - Base path:', MEDIAPIPE_CONFIG.BASE_PATH);
      console.error('  - Task path:', getMediaPipeAssetPath(MEDIAPIPE_CONFIG.FACE_LANDMARKER_TASK));
      
      // Lanzar error más descriptivo
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`No se pudo cargar el modelo de detección facial: ${errorMessage}`);
    }
  }

  /**
   * Procesa un frame de video para detectar rostros
   */
  processVideoFrame(video: HTMLVideoElement): FaceDetectionResult | null {
    if (!this.isModelLoaded || !this.faceLandmarker) {
      return null;
    }

    try {
      const results: FaceLandmarkerResult = this.faceLandmarker.detectForVideo(video, performance.now());
      
      if (results.faceLandmarks.length > 0) {
        const face = results.faceLandmarks[0] as FaceLandmark[];

        if (face.length < 478) {
          console.warn('⚠️ Landmarks insuficientes para detectar parpadeo y movimientos');
          return null;
        }

        const nose = face[1];
        const isCentered = FaceDetectionUtils.isFaceCentered(nose);
        const blinkDetected = FaceDetectionUtils.detectBlink(face);
        const distanceBetweenEyes = FaceDetectionUtils.calculateDistanceBetweenEyes(face);

        const result: FaceDetectionResult = {
          faceLandmarks: FaceDetectionUtils.extractFaceLandmarks(face),
          isCentered,
          blinkDetected,
          distanceBetweenEyes
        };

        this.detectionSubject.next(result);
        return result;
      }
    } catch (error) {
      console.error('❌ Error al procesar frame:', error);
    }

    return null;
  }

  /**
   * Verifica si el modelo está cargado
   */
  isModelReady(): boolean {
    return this.isModelLoaded;
  }

  /**
   * Limpia recursos
   */
  private cleanup(): void {
    this.detectionSubject.complete();
  }


} 