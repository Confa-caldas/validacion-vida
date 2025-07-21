import { Injectable, OnDestroy } from '@angular/core';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { BehaviorSubject, Observable } from 'rxjs';
import { FaceLandmark, FaceDetectionResult } from '../models';
import { FaceDetectionUtils } from '../../shared/utils/face-detection.utils';

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
   * Carga el modelo de MediaPipe
   */
  async loadModel(): Promise<void> {
    try {
      const wasmUrl = '/assets/modelos/vision_wasm_internal.wasm';
      const response = await fetch(wasmUrl);
      const wasmBinary = await response.arrayBuffer();

      // Monkey patch: algunas versiones esperan esto globalmente
      (globalThis as any).wasmBinary = wasmBinary;

      const vision = await FilesetResolver.forVisionTasks('/assets/modelos');

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/assets/modelos/face_landmarker.task'
        },
        runningMode: 'VIDEO',
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true
      });

      this.isModelLoaded = true;
      console.log('✅ Modelo de detección facial cargado correctamente');
    } catch (error) {
      console.error('❌ Error al cargar el modelo:', error);
      throw new Error('No se pudo cargar el modelo de detección facial');
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