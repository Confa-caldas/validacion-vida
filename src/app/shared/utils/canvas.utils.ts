import { CANVAS_CONFIG } from '../../config/constants';

export class CanvasUtils {
  
  /**
   * Redimensiona el canvas según el tamaño de la pantalla
   */
  static resizeCanvas(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
    const isDesktop = window.innerWidth >= 768;

    const canvasWidth = isDesktop ? CANVAS_CONFIG.DESKTOP_WIDTH : window.innerWidth;
    const canvasHeight = isDesktop ? CANVAS_CONFIG.DESKTOP_HEIGHT : canvasWidth * CANVAS_CONFIG.MOBILE_ASPECT_RATIO;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    video.style.width = `${canvasWidth}px`;
    video.style.height = `${canvasHeight}px`;

    console.log(`📐 Canvas resized: ${canvasWidth}x${canvasHeight}`);
  }

  /**
   * Captura una imagen del canvas en formato Base64
   */
  static captureCanvasImage(canvas: HTMLCanvasElement): string {
    if (!canvas) {
      throw new Error('Canvas no definido');
    }
    return canvas.toDataURL('image/png');
  }

  /**
   * Dibuja una guía visual en el canvas
   */
  static drawVisualGuide(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    direction: string | null,
    isCenteringMode: boolean = false
  ): void {
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    let x = w / 2;
    let y = h / 2;
    let radioX = 80;
    let radioY = 100;

    // Si estamos en modo "centrar rostro", dibujamos guía central en color gris
    if (isCenteringMode) {
      ctx.strokeStyle = '#9E9E9E'; // gris neutro
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]); // línea punteada
      ctx.beginPath();
      ctx.ellipse(x, y, radioX, radioY, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // reset
      return;
    }

    // Guía para movimiento activo
    switch (direction) {
      case 'izquierda':
        x = w * 0.75;
        break;
      case 'derecha':
        x = w * 0.25;
        break;
      case 'arriba':
        y = h * 0.25;
        break;
      case 'abajo':
        y = h * 0.75;
        break;
      case 'acercarse':
        radioX /= 2;
        radioY /= 2;
        break;
      default:
        break;
    }

    ctx.strokeStyle = '#2196F3'; // azul
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y, radioX, radioY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
} 