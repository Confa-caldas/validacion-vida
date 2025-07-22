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
   * Verifica que todos los archivos necesarios estén disponibles
   */
  private async verifyAssets(): Promise<void> {
    const requiredAssets = [
      MEDIAPIPE_CONFIG.WASM_FILE,
      MEDIAPIPE_CONFIG.FACE_LANDMARKER_TASK,
      MEDIAPIPE_CONFIG.FACE_LANDMARK_MODEL,
      MEDIAPIPE_CONFIG.FACE_LANDMARK_MANIFEST,
      MEDIAPIPE_CONFIG.SSD_MODEL_SHARD1,
      MEDIAPIPE_CONFIG.SSD_MODEL_SHARD2,
      MEDIAPIPE_CONFIG.SSD_MANIFEST
    ];

    console.log('🔍 Verificando disponibilidad de archivos...');
    
    for (const asset of requiredAssets) {
      const assetUrl = getMediaPipeAssetPath(asset);
      try {
        const response = await fetch(assetUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Archivo no disponible: ${asset} (${response.status})`);
        }
        console.log(`✅ ${asset} - Disponible`);
      } catch (error) {
        console.error(`❌ ${asset} - Error:`, error);
        throw new Error(`No se puede acceder al archivo: ${asset}`);
      }
    }
    
    console.log('✅ Todos los archivos están disponibles');
  }

  /**
   * Carga el modelo de MediaPipe
   */
  async loadModel(): Promise<void> {
    try {
      console.log('🔄 Iniciando carga del modelo...');
      
      // Verificar que todos los archivos estén disponibles
      await this.verifyAssets();
      
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const wasmUrl = getMediaPipeAssetPath(MEDIAPIPE_CONFIG.WASM_FILE) + `?v=${timestamp}&r=${random}&nocache=true`;
      console.log('📁 Intentando cargar WASM desde:', wasmUrl);
      
      // Verificar que el archivo WASM existe y tiene el contenido correcto
      const wasmResponse = await fetch(wasmUrl);
      if (!wasmResponse.ok) {
        throw new Error(`No se pudo cargar el archivo WASM: ${wasmResponse.status} ${wasmResponse.statusText}`);
      }
      
      // Verificar que el Content-Type sea correcto
      const contentType = wasmResponse.headers.get('content-type');
      if (contentType && !contentType.includes('application/wasm') && !contentType.includes('application/octet-stream')) {
        console.warn('⚠️ Content-Type incorrecto para WASM:', contentType);
        console.warn('⚠️ Esto puede causar problemas de carga');
      }
      
      const wasmBinary = await wasmResponse.arrayBuffer();
      console.log('✅ Archivo WASM cargado correctamente, tamaño:', wasmBinary.byteLength, 'bytes');

      // Verificar que el archivo WASM tenga el magic number correcto
      const uint8Array = new Uint8Array(wasmBinary);
      const magicNumber = Array.from(uint8Array.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      if (magicNumber !== '00 61 73 6d') {
        throw new Error(`Archivo WASM inválido. Magic number esperado: 00 61 73 6d, encontrado: ${magicNumber}`);
      }

      // Monkey patch: algunas versiones esperan esto globalmente
      (globalThis as any).wasmBinary = wasmBinary;

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