import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

@Component({
  selector: 'app-live-check',
  templateUrl: './live-check.component.html',
  styleUrls: ['./live-check.component.css']
})
export class LiveCheckComponent implements OnInit, OnDestroy {

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  faceLandmarker!: FaceLandmarker;
  video!: HTMLVideoElement;
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  movimientos = ['arriba', 'abajo', 'izquierda', 'derecha', 'acercarse'];
  secuenciaMovimientos: string[] = [];
  pasoActual: number = 0;

  esperaCentro = false;
  validandoMovimiento = false;
  validationInProgress = false;
  tiempoLimite: any;
  contadorPreparacion: number = 3;

  statusMessage = 'Presiona "Validar" para comenzar.';
  distanciaInicial: number | null = null;

  // Variables de parpadeo
  blinkDetected = false;
  parpadeoActivo: boolean = false; // Evita conteo doble
  parpadeosDetectados: number = 0;
  requeridosParpadeos: number = 3;

  ngOnInit() {
    // Puedes iniciar cámara aquí si lo deseas
    // this.iniciarCamara();
 
  }

  ngOnDestroy() {
    this.detenerCamara();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
  this.canvas.height = window.innerHeight;
  }

  async iniciarCamara() {
    this.video = this.videoRef.nativeElement;
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    this.video.srcObject = stream;
    await this.video.play();

    await this.cargarModelo();
    this.procesarVideo();
  }

  detenerCamara() {
    const stream = this.video?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
  }

  async cargarModelo() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: '/assets/modelos/face_landmarker.task'
      },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true
    });
  }

  procesarVideo() {
    const processFrame = async () => {
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        const results: FaceLandmarkerResult = this.faceLandmarker.detectForVideo(this.video, performance.now());
        if (results.faceLandmarks.length > 0) {
          const face = results.faceLandmarks[0];

          if (face.length < 478) {
            console.warn('⚠️ Landmarks insuficientes para detectar parpadeo y movimientos');
          } else {
            this.procesarDeteccion(face, results);
          }
        }
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  iniciarValidacion() {
    this.resetValidacion();
    if (this.validationInProgress) return;

    console.log('🔄 Reiniciando validación...');
    this.validationInProgress = true;
    this.statusMessage = '🔄 Preparando validación...';

    // Secuencia aleatoria de 3 movimientos (sin repetir)
    this.secuenciaMovimientos = this.shuffleArray([...this.movimientos]).slice(0, 3);
    this.pasoActual = 0;
    this.parpadeosDetectados = 0;
    this.distanciaInicial = null;

    this.esperaCentro = true;
    this.validandoMovimiento = false;

    console.log('🎲 Secuencia:', this.secuenciaMovimientos);
    this.statusMessage = '🕒 Alinea el rostro al centro...';
  }

  procesarDeteccion(face: any[], results: FaceLandmarkerResult) {
    // Siempre analiza el parpadeo
    this.verificarParpadeo(face);

    if (!this.validationInProgress) return;

    const nose = face[1];
    if (!nose) return;

    if (this.esperaCentro) {
      if (this.estaCentrado(nose)) {
        this.esperaCentro = false;
        this.prepararSiguienteMovimiento();
      } else {
        this.statusMessage = '🕒 Alinea el rostro al centro...';
      }
    } else if (this.validandoMovimiento) {
      this.verificarMovimiento(face, nose);
    }
  }

  prepararSiguienteMovimiento() {
    this.statusMessage = `Prepárate para "${this.secuenciaMovimientos[this.pasoActual]}"...`;
    this.contadorPreparacion = 3;

    const interval = setInterval(() => {
      if (this.contadorPreparacion <= 0) {
        clearInterval(interval);
        this.statusMessage = `Realiza el movimiento: "${this.secuenciaMovimientos[this.pasoActual]}"`;

        this.validandoMovimiento = true;

        this.tiempoLimite = setTimeout(() => {
          this.falloValidacion('⏰ Tiempo agotado');
        }, 6000);
      } else {
        this.statusMessage = `Prepárate para "${this.secuenciaMovimientos[this.pasoActual]}" en ${this.contadorPreparacion}...`;
        this.contadorPreparacion--;
      }
    }, 1000);
  }

  verificarMovimiento(face: any[], nose: any) {
    const movimientoActual = this.secuenciaMovimientos[this.pasoActual];
    const umbral = 0.03;

    const centroX = nose.x;
    const centroY = nose.y;

    let movimientoDetectado = false;

    switch (movimientoActual) {
      case 'arriba':
        movimientoDetectado = centroY < 0.45;
        break;
      case 'abajo':
        movimientoDetectado = centroY > 0.55;
        break;
      case 'izquierda':
        movimientoDetectado = centroX > 0.45;
        break;
      case 'derecha':
        movimientoDetectado = centroX < 0.55;
        break;
      case 'acercarse':
        if (!this.distanciaInicial) {
          this.distanciaInicial = this.calcularDistanciaEntreOjos(face);
        }
        const distanciaActual = this.calcularDistanciaEntreOjos(face);
        const diferencia = distanciaActual / this.distanciaInicial;
        movimientoDetectado = diferencia > 1.2; // Umbral de acercamiento
        break;
    }

    if (movimientoDetectado) {
      console.log(`✅ Movimiento "${movimientoActual}" detectado correctamente`);
      clearTimeout(this.tiempoLimite);
      this.validandoMovimiento = false;

      this.pasoActual++;

      if (this.pasoActual >= this.secuenciaMovimientos.length) {
        this.finalizarValidacion();
      } else {
        this.esperaCentro = true;
        this.statusMessage = '🕒 Alinea el rostro al centro para continuar...';
      }
    } else {
      console.log(`❌ Aún no detectado "${movimientoActual}"`);
    }
  }

  verificarParpadeo(face: any[]) {
    const ojoDerechoArriba = face[159];
    const ojoDerechoAbajo = face[145];
    const ojoIzquierdoArriba = face[386];
    const ojoIzquierdoAbajo = face[374];

    const distDerecho = Math.abs(ojoDerechoArriba.y - ojoDerechoAbajo.y);
    const distIzquierdo = Math.abs(ojoIzquierdoArriba.y - ojoIzquierdoAbajo.y);

    const umbralParpadeo = 0.005;

    if (distDerecho < umbralParpadeo && distIzquierdo < umbralParpadeo) {
      if (!this.parpadeoActivo) {
        this.parpadeoActivo = true;
        this.parpadeosDetectados++;
        console.log(`👁️‍🗨️ Parpadeo detectado (${this.parpadeosDetectados}/${this.requeridosParpadeos})`);
      }
    } else {
      this.parpadeoActivo = false;
    }
  }

  falloValidacion(mensaje: string) {
    clearTimeout(this.tiempoLimite);
    this.validationInProgress = false;
    this.validandoMovimiento = false;
    this.esperaCentro = false;

    this.statusMessage = `❌ Validación fallida: ${mensaje}. Intenta de nuevo.`;
    console.log('❌ Fallo en la validación');
  }

  finalizarValidacion() {
    if (this.parpadeosDetectados >= this.requeridosParpadeos) {
      this.statusMessage = '✅ Validación exitosa. ¡Bien hecho!';
      console.log('✔️ Validación completa');
    } else {
      this.statusMessage = '❌ Parpadeos insuficientes. Intenta de nuevo.';
      console.log('❌ Faltaron parpadeos');
    }

    //this.resetValidacion();
  }

  resetValidacion() {
    this.validationInProgress = false;
    this.validandoMovimiento = false;
    this.esperaCentro = false;

    this.secuenciaMovimientos = [];
    this.pasoActual = 0;
    this.parpadeosDetectados = 0;
    this.distanciaInicial = null;

    clearTimeout(this.tiempoLimite);

    this.statusMessage = 'Presiona "Validar" para comenzar de nuevo.';
  }

  estaCentrado(nose: any): boolean {
    const margenX = 0.05;
    const margenY = 0.05;

    return (
      nose.x > 0.5 - margenX &&
      nose.x < 0.5 + margenX &&
      nose.y > 0.5 - margenY &&
      nose.y < 0.5 + margenY
    );
  }

  calcularDistanciaEntreOjos(face: any[]): number {
    const ojoIzquierdo = face[33];
    const ojoDerecho = face[263];

    const dx = ojoIzquierdo.x - ojoDerecho.x;
    const dy = ojoIzquierdo.y - ojoDerecho.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  shuffleArray(array: string[]): string[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
