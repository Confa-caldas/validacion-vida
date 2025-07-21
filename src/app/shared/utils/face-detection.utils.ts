import { VALIDATION_CONFIG } from '../../config/api.config';
import { FaceLandmark, FaceLandmarks } from '../../core/models';

export class FaceDetectionUtils {

  /**
   * Verifica si el rostro está centrado
   */
  static isFaceCentered(nose: FaceLandmark): boolean {
    const margenX = VALIDATION_CONFIG.CENTER_THRESHOLD;
    const margenY = VALIDATION_CONFIG.CENTER_THRESHOLD;

    return (
      nose.x > 0.5 - margenX &&
      nose.x < 0.5 + margenX &&
      nose.y > 0.5 - margenY &&
      nose.y < 0.5 + margenY
    );
  }

  /**
   * Calcula la distancia entre los ojos
   */
  static calculateDistanceBetweenEyes(face: FaceLandmark[]): number {
    const ojoIzquierdo = face[33];
    const ojoDerecho = face[263];

    const dx = ojoIzquierdo.x - ojoDerecho.x;
    const dy = ojoIzquierdo.y - ojoDerecho.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Verifica si se detectó un parpadeo
   */
  static detectBlink(face: FaceLandmark[]): boolean {
    const ojoDerechoArriba = face[159];
    const ojoDerechoAbajo = face[145];
    const ojoIzquierdoArriba = face[386];
    const ojoIzquierdoAbajo = face[374];

    const distDerecho = Math.abs(ojoDerechoArriba.y - ojoDerechoAbajo.y);
    const distIzquierdo = Math.abs(ojoIzquierdoArriba.y - ojoIzquierdoAbajo.y);

    return distDerecho < VALIDATION_CONFIG.BLINK_THRESHOLD && 
           distIzquierdo < VALIDATION_CONFIG.BLINK_THRESHOLD;
  }

  /**
   * Verifica si se detectó un movimiento específico
   */
  static detectMovement(face: FaceLandmark[], movement: string, initialDistance?: number): boolean {
    const nose = face[1];
    if (!nose) return false;

    const centroX = nose.x;
    const centroY = nose.y;

    switch (movement) {
      case 'arriba':
        return centroY < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ARRIBA;
      case 'abajo':
        return centroY > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ABAJO;
      case 'izquierda':
        return centroX > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA;
      case 'derecha':
        return centroX < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA;
      case 'acercarse':
        if (!initialDistance) return false;
        const distanciaActual = this.calculateDistanceBetweenEyes(face);
        const diferencia = distanciaActual / initialDistance;
        return diferencia > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ACERCARSE;
      default:
        return false;
    }
  }

  /**
   * Obtiene información de debug para un movimiento específico
   */
  static getMovementDebugInfo(face: FaceLandmark[], movement: string, initialDistance?: number): any {
    const nose = face[1];
    if (!nose) return null;

    const centroX = nose.x;
    const centroY = nose.y;

    switch (movement) {
      case 'arriba':
        return {
          movement,
          currentY: centroY,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ARRIBA,
          detected: centroY < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ARRIBA
        };
      case 'abajo':
        return {
          movement,
          currentY: centroY,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ABAJO,
          detected: centroY > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ABAJO
        };
      case 'izquierda':
        return {
          movement,
          currentX: centroX,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA,
          detected: centroX > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA
        };
      case 'derecha':
        return {
          movement,
          currentX: centroX,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA,
          detected: centroX < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA
        };
      case 'acercarse':
        if (!initialDistance) return null;
        const distanciaActual = this.calculateDistanceBetweenEyes(face);
        const diferencia = distanciaActual / initialDistance;
        return {
          movement,
          currentDistance: distanciaActual,
          initialDistance,
          ratio: diferencia,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ACERCARSE,
          detected: diferencia > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ACERCARSE
        };
      default:
        return null;
    }
  }

  /**
   * Extrae los landmarks faciales estructurados
   */
  static extractFaceLandmarks(face: FaceLandmark[]): FaceLandmarks {
    return {
      landmarks: face,
      nose: face[1],
      leftEye: {
        top: face[386],
        bottom: face[374],
        center: face[33]
      },
      rightEye: {
        top: face[159],
        bottom: face[145],
        center: face[263]
      }
    };
  }
} 