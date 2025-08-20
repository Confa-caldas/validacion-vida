import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { FaceLandmark, FaceDetectionResult } from '../models';
import { FaceDetectionUtils } from '../../shared/utils/face-detection.utils';
import { DETECTION_API_CONFIG } from '../../config/api.config';

interface PythonApiResponse {
  rostros_detectados: number;
  resultados: Array<{
    puntos: Array<{x: number, y: number, z: number}>;
    parpadeo: boolean;
    centrado: boolean;
    movimientos: {
      arriba: boolean;
      abajo: boolean;
      izquierda: boolean;
      derecha: boolean;
      acercarse: boolean;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class FaceDetectionService implements OnDestroy {
  
  private isModelLoaded = true; // Siempre disponible ya que usamos API
  private detectionSubject = new BehaviorSubject<FaceDetectionResult | null>(null);
  
  public detection$ = this.detectionSubject.asObservable();

  constructor(private http: HttpClient) { }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Carga el modelo (siempre disponible con API)
   */
  async loadModel(): Promise<void> {
    // Con la API de Python, el modelo siempre está disponible
    console.log('✅ Modelo disponible a través de API de Python');
    this.isModelLoaded = true;
  }

  private lastProcessTime = 0;
  private readonly PROCESS_INTERVAL = 100; // Procesar cada 100ms (10 FPS) para mejor detección

  /**
   * Verifica si el servidor de Python está disponible
   */
  async checkServerAvailability(): Promise<boolean> {
    try {
      const response = await this.http.get(DETECTION_API_CONFIG.FULL_URL.replace('/detectar-rostro/', '/health')).toPromise();
      return true;
    } catch (error) {
      console.warn('⚠️ Servidor de Python no disponible. Verifica que esté ejecutándose en http://localhost');
      return false;
    }
  }

  /**
   * Procesa un frame de video enviándolo a la API de Python
   */
  async processVideoFrame(video: HTMLVideoElement, sessionId?: string, currentMovement?: string): Promise<FaceDetectionResult | null> {
    if (!this.isModelLoaded) {
      return null;
    }

    // Verificar que el video esté disponible y activo
    if (!video || video.readyState !== 4 || video.paused || video.ended) {
      return null;
    }

    // Control de frecuencia para evitar sobrecarga
    const now = Date.now();
    if (now - this.lastProcessTime < this.PROCESS_INTERVAL) {
      return null;
    }
    this.lastProcessTime = now;



    try {
      // Capturar frame del video con resolución optimizada
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Optimizar resolución para mejor detección
      const scale = 0.7; // Aumentar resolución para mejor precisión
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convertir a base64 con calidad optimizada
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8); // Mejor calidad

      // Enviar a la API de Python (solo imagen, sin información de sesión)
      const requestData: any = {
        imagen_base64: imageBase64
      };
      
             const response = await this.http.post<PythonApiResponse>(DETECTION_API_CONFIG.FULL_URL, requestData).toPromise();

      if (response && response.resultados && response.resultados.length > 0) {
        const resultado = response.resultados[0];
        
        // Convertir los puntos de Python al formato de Angular
        const faceLandmarks = resultado.puntos.map((punto) => ({
          x: punto.x,
          y: punto.y,
          z: punto.z
        }));

        // Extraer información del resultado
        const isCentered = resultado.centrado;
        const blinkDetected = resultado.parpadeo;
        const distanceBetweenEyes = FaceDetectionUtils.calculateDistanceBetweenEyes(faceLandmarks);

        const result: FaceDetectionResult = {
          faceLandmarks: FaceDetectionUtils.extractFaceLandmarks(faceLandmarks),
          isCentered,
          blinkDetected,
          distanceBetweenEyes
        };

        this.detectionSubject.next(result);
        return result;
      }
    } catch (error: any) {
      // Manejo específico de errores de conexión
      if (error.status === 404) {
        console.warn('⚠️ Servidor de Python no disponible (404). Verifica que esté ejecutándose en http://localhost');
        return null;
      } else if (error.status === 0) {
        console.warn('⚠️ No se puede conectar al servidor de Python. Verifica que esté ejecutándose.');
        return null;
      } else {
        console.error('❌ Error al procesar frame con API de Python:', error);
      }
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