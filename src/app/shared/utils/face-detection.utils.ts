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
        return centroX < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA;
      case 'derecha':
        return centroX > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA;
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
          detected: centroY < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ARRIBA,
          difference: centroY - VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ARRIBA
        };
      case 'abajo':
        return {
          movement,
          currentY: centroY,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ABAJO,
          detected: centroY > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ABAJO,
          difference: centroY - VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.ABAJO
        };
      case 'izquierda':
        return {
          movement,
          currentX: centroX,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA,
          detected: centroX < VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA,
          difference: centroX - VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.IZQUIERDA
        };
      case 'derecha':
        return {
          movement,
          currentX: centroX,
          threshold: VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA,
          detected: centroX > VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA,
          difference: centroX - VALIDATION_CONFIG.MOVEMENT_THRESHOLDS.DERECHA
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

  /**
   * Detecta todos los gestos faciales disponibles
   */
  static detectAllGestures(face: FaceLandmark[]): any {
    return {
      boca_abierta: this.detectOpenMouth(face),
      cejas_fruncidas: this.detectFrown(face),
      sonrisa: this.detectSmile(face),
      guiño: this.detectWink(face)
    };
  }

  /**
   * Detecta si la boca está abierta
   */
  static detectOpenMouth(face: FaceLandmark[]): boolean {
    const labioSuperior = face[13];  // Centro labio superior
    const labioInferior = face[14];  // Centro labio inferior
    
    const distanciaLabios = Math.abs(labioSuperior.y - labioInferior.y);
    const threshold = VALIDATION_CONFIG.GESTURE_THRESHOLDS.BOCA_ABIERTA;
    const detected = distanciaLabios > threshold;
    
    // Log más detallado para debugging
    console.log(`👄 Boca abierta - Umbral ajustado: ${threshold} (más sensible)`);
    console.log(`👄 Boca abierta - LabioSuperior Y: ${labioSuperior.y.toFixed(4)}, LabioInferior Y: ${labioInferior.y.toFixed(4)}`);
    console.log(`👄 Boca abierta - Distancia: ${distanciaLabios.toFixed(4)}, Umbral: ${threshold}, Detectado: ${detected}`);
    console.log(`👄 Boca abierta - Diferencia: ${(distanciaLabios - threshold).toFixed(4)}`);
    
    return detected;
  }

  /**
   * Detecta si las cejas están fruncidas
   */
  static detectFrown(face: FaceLandmark[]): boolean {
    const cejaIzqCentro = face[66];   // Centro ceja izquierda
    const cejaDerCentro = face[296];  // Centro ceja derecha
    const ojoIzqCentro = face[33];    // Centro ojo izquierdo
    const ojoDerCentro = face[263];   // Centro ojo derecho
    
    const distCejaIzq = Math.abs(cejaIzqCentro.y - ojoIzqCentro.y);
    const distCejaDer = Math.abs(cejaDerCentro.y - ojoDerCentro.y);
    
    const distanciaPromedio = (distCejaIzq + distCejaDer) / 2;
    const threshold = VALIDATION_CONFIG.GESTURE_THRESHOLDS.CEJAS_FRUNCIDAS;
    const detected = distanciaPromedio < threshold;
    
    console.log(`😠 Cejas fruncidas - Distancia promedio: ${distanciaPromedio.toFixed(4)}, Umbral: ${threshold}, Detectado: ${detected}`);
    console.log(`😠 Cejas fruncidas - Izquierda: ${distCejaIzq.toFixed(4)}, Derecha: ${distCejaDer.toFixed(4)}`);
    
    return detected;
  }

  /**
   * Detecta si la persona está sonriendo
   */
  static detectSmile(face: FaceLandmark[]): boolean {
    const comisuraIzq = face[61];  // Comisura izquierda
    const comisuraDer = face[291];  // Comisura derecha
    const centroBoca = face[13];    // Centro del labio superior
    
    // Log detallado de los valores
    console.log(`😊 Sonrisa - Valores Y: ComisuraIzq: ${comisuraIzq.y.toFixed(4)}, ComisuraDer: ${comisuraDer.y.toFixed(4)}, CentroBoca: ${centroBoca.y.toFixed(4)}`);
    
    // Método principal: Detectar elevación de comisuras
    const labioInferior = face[14];  // Centro labio inferior
    const distanciaComisuraIzq = Math.abs(comisuraIzq.y - labioInferior.y);
    const distanciaComisuraDer = Math.abs(comisuraDer.y - labioInferior.y);
    const distanciaCentro = Math.abs(centroBoca.y - labioInferior.y);
    
    // Si las comisuras están más cerca del labio superior que del inferior, es sonrisa
    const detected = distanciaComisuraIzq < distanciaCentro && distanciaComisuraDer < distanciaCentro;
    
    console.log(`😊 Sonrisa - Distancias: ComisuraIzq: ${distanciaComisuraIzq.toFixed(4)}, ComisuraDer: ${distanciaComisuraDer.toFixed(4)}, Centro: ${distanciaCentro.toFixed(4)}`);
    console.log(`😊 Sonrisa - Detectado: ${detected}`);
    
    return detected;
  }

  /**
   * Detecta guiño de cada ojo por separado
   */
  static detectWink(face: FaceLandmark[]): any {
    const ojoDerArriba = face[159];  // Párpado superior derecho
    const ojoDerAbajo = face[145];   // Párpado inferior derecho
    const ojoIzqArriba = face[386];  // Párpado superior izquierdo
    const ojoIzqAbajo = face[374];   // Párpado inferior izquierdo
    
    const distDerecho = Math.abs(ojoDerArriba.y - ojoDerAbajo.y);
    const distIzquierdo = Math.abs(ojoIzqArriba.y - ojoIzqAbajo.y);
    
    const umbralGuino = VALIDATION_CONFIG.GESTURE_THRESHOLDS.GUINO;
    
    const guinoDer = distDerecho < umbralGuino;
    const guinoIzq = distIzquierdo < umbralGuino;
    const cualquierGuino = guinoDer || guinoIzq;
    
    console.log(`😉 Guiño - Umbral actualizado: ${umbralGuino} (menos estricto)`);
    console.log(`😉 Guiño - Derecho: ${distDerecho.toFixed(4)} (${guinoDer}), Izquierdo: ${distIzquierdo.toFixed(4)} (${guinoIzq}), Cualquier: ${cualquierGuino}`);
    console.log(`😉 Guiño - Párpados derecho: Superior ${ojoDerArriba.y.toFixed(4)}, Inferior ${ojoDerAbajo.y.toFixed(4)}`);
    console.log(`😉 Guiño - Párpados izquierdo: Superior ${ojoIzqArriba.y.toFixed(4)}, Inferior ${ojoIzqAbajo.y.toFixed(4)}`);
    
    return {
      guiño_derecho: guinoDer,
      guiño_izquierdo: guinoIzq,
      cualquier_guiño: cualquierGuino
    };
  }

  /**
   * Detecta un gesto facial específico
   */
  static detectGesture(face: FaceLandmark[], gesture: string): boolean {
    switch (gesture) {
      case 'boca_abierta':
        return this.detectOpenMouth(face);
      case 'cejas_fruncidas':
        return this.detectFrown(face);
      case 'sonrisa':
        return this.detectSmile(face);
      case 'guiño_derecho':
        return this.detectWink(face).guiño_derecho;
      case 'guiño_izquierdo':
        return this.detectWink(face).guiño_izquierdo;
      case 'cualquier_guiño':
        return this.detectWink(face).cualquier_guiño;
      default:
        return false;
    }
  }

  /**
   * Obtiene información de debug para un gesto específico
   */
  static getGestureDebugInfo(face: FaceLandmark[], gesture: string): any {
    switch (gesture) {
      case 'boca_abierta':
        const labioSuperior = face[13];
        const labioInferior = face[14];
        const distanciaLabios = Math.abs(labioSuperior.y - labioInferior.y);
        return {
          gesture,
          currentDistance: distanciaLabios,
          threshold: VALIDATION_CONFIG.GESTURE_THRESHOLDS.BOCA_ABIERTA,
          detected: distanciaLabios > VALIDATION_CONFIG.GESTURE_THRESHOLDS.BOCA_ABIERTA
        };
      case 'cejas_fruncidas':
        const cejaIzqCentro = face[66];
        const cejaDerCentro = face[296];
        const ojoIzqCentro = face[33];
        const ojoDerCentro = face[263];
        const distCejaIzq = Math.abs(cejaIzqCentro.y - ojoIzqCentro.y);
        const distCejaDer = Math.abs(cejaDerCentro.y - ojoDerCentro.y);
        const distanciaPromedio = (distCejaIzq + distCejaDer) / 2;
        return {
          gesture,
          currentDistance: distanciaPromedio,
          threshold: VALIDATION_CONFIG.GESTURE_THRESHOLDS.CEJAS_FRUNCIDAS,
          detected: distanciaPromedio < VALIDATION_CONFIG.GESTURE_THRESHOLDS.CEJAS_FRUNCIDAS
        };
      case 'sonrisa':
        const comisuraIzq = face[61];
        const comisuraDer = face[291];
        const centroBoca = face[13];
        const sonrisaIzq = comisuraIzq.y < centroBoca.y;
        const sonrisaDer = comisuraDer.y < centroBoca.y;
        return {
          gesture,
          leftSmile: sonrisaIzq,
          rightSmile: sonrisaDer,
          detected: sonrisaIzq && sonrisaDer
        };
      case 'guiño_derecho':
      case 'guiño_izquierdo':
      case 'cualquier_guiño':
        const winkInfo = this.detectWink(face);
        return {
          gesture,
          rightWink: winkInfo.guiño_derecho,
          leftWink: winkInfo.guiño_izquierdo,
          anyWink: winkInfo.cualquier_guiño,
          detected: gesture === 'guiño_derecho' ? winkInfo.guiño_derecho :
                   gesture === 'guiño_izquierdo' ? winkInfo.guiño_izquierdo :
                   winkInfo.cualquier_guiño
        };
      default:
        return null;
    }
  }
} 