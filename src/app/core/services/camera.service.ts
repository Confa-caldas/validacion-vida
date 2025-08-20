import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CameraConstraints {
  width: { ideal: number };
  height: { ideal: number };
  facingMode: 'user' | 'environment';
}

@Injectable({
  providedIn: 'root'
})
export class CameraService {
  
  private streamSubject = new BehaviorSubject<MediaStream | null>(null);
  private isActiveSubject = new BehaviorSubject<boolean>(false);
  
  public stream$ = this.streamSubject.asObservable();
  public isActive$ = this.isActiveSubject.asObservable();

  constructor() { }

  /**
   * Inicia la cámara con las restricciones especificadas
   */
  async startCamera(constraints: CameraConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user'
  }): Promise<MediaStream> {
    try {
      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia no está soportado en este navegador');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints
      });

      this.streamSubject.next(stream);
      this.isActiveSubject.next(true);
      
      console.log('✅ Cámara iniciada correctamente');
      return stream;
    } catch (error) {
      console.error('❌ Error al iniciar cámara:', error);
      throw new Error(`No se pudo acceder a la cámara: ${error}`);
    }
  }

  /**
   * Detiene la cámara
   */
  stopCamera(): void {
    const currentStream = this.streamSubject.value;
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        track.stop();
      });
      
      this.streamSubject.next(null);
      this.isActiveSubject.next(false);
      console.log('🛑 Cámara detenida');
    }
  }

  /**
   * Verifica si la cámara está activa
   */
  isCameraActive(): boolean {
    return this.isActiveSubject.value;
  }
} 