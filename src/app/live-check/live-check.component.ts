import { Component, OnInit } from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-live-check',
  templateUrl: './live-check.component.html',
  styleUrls: ['./live-check.component.css']
})
export class LiveCheckComponent implements OnInit {

  videoElement: HTMLVideoElement | null = null;
  canvas: HTMLCanvasElement | null = null;
  stream: MediaStream | null = null;

  currentStep: number = 0;
  maxSteps = 3;
  steps: string[] = [];

  waitingForAction = false;
  validationFailed = false;
  isRunningValidation = false;

  countdown: number = 3;
  countdownInterval: any;
  movementInterval: any;

  ngOnInit(): void {
    this.loadModels();
  }

  async loadModels() {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/assets/modelos');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/assets/modelos');

    console.log('✅ MODELOS CARGADOS');
  }

  startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        this.stream = stream;
        this.videoElement = document.getElementById('video') as HTMLVideoElement;

        if (this.videoElement) {
          this.videoElement.srcObject = stream;
          this.videoElement.onloadedmetadata = () => {
            this.videoElement!.play();
            this.createCanvasOverlay();
          };
        }
      })
      .catch((err) => console.error('❌ ERROR CON LA CÁMARA:', err));
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.stream = null;
  }

  createCanvasOverlay() {
    if (!this.videoElement) return;

    this.canvas = faceapi.createCanvasFromMedia(this.videoElement);
    const container = document.getElementById('video-container');
    if (container) {
      container.appendChild(this.canvas);
    }

    faceapi.matchDimensions(this.canvas, {
      width: this.videoElement.width,
      height: this.videoElement.height
    });
  }

  startMovementValidation() {
    console.clear(); // Para limpieza en cada prueba
    console.log('[INICIO] startMovementValidation');

    this.currentStep = 0;
    this.validationFailed = false;
    this.isRunningValidation = true;

    this.steps = this.shuffleArray(['izquierda', 'derecha', 'arriba', 'acercarse']).slice(0, this.maxSteps);
    console.log('🎲 MOVIMIENTOS ALEATORIOS:', this.steps);

    this.nextStep(); // Inicia el primer paso
  }

  nextStep() {
    console.log('[INICIO] nextStep');

    if (this.validationFailed || !this.isRunningValidation) {
      console.warn('⚠️ Validación cancelada o ya terminada.');
      return;
    }

    if (this.currentStep >= this.maxSteps) {
      this.finalizarValidacion();
      return;
    }

    const pasoActual = this.currentStep + 1;
    const movimientoActual = this.steps[this.currentStep];

    console.log(`🔎 Paso actual: ${pasoActual}/${this.maxSteps}`);
    console.log(`➡ Esperando movimiento: ${movimientoActual}`);

    this.waitingForAction = false;

    // Mensaje de preparación
    this.showMessage('🕑 VUELVE AL CENTRO...', 'info');

    setTimeout(() => {
      const mensaje = `➡ MUEVE TU CABEZA HACIA ${movimientoActual.toUpperCase()}`;

      this.showMessage(`${mensaje} (PREPÁRATE)`, 'info');

      this.startCountdown(() => {
        this.showMessage(`${mensaje} AHORA`, 'info');

        if (this.waitingForAction) {
          console.warn('⚠️ Ya estamos esperando un movimiento, no deberíamos iniciar otro.');
          return;
        }

        this.waitingForAction = true;

        // Aquí NO incrementamos currentStep, solo iniciamos la validación
        this.validateMovement(movimientoActual);
      });
    }, 1500);
  }

  finalizarValidacion() {
    console.log('[INICIO] finalizarValidacion');

    if (!this.isRunningValidation) {
      console.warn('⚠️ Ya se finalizó la validación.');
      return;
    }

    this.isRunningValidation = false;
    this.waitingForAction = false;
    this.clearIntervals();

    this.showMessage('✅ VALIDACIÓN EXITOSA.', 'success');
    console.log(`🎉 Validación completada en paso: ${this.currentStep}/${this.maxSteps}`);
  }

  startCountdown(callback: () => void) {
    this.countdown = 3;
    this.updateCountdownDisplay();

    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown > 0) {
        this.updateCountdownDisplay();
      } else {
        clearInterval(this.countdownInterval);
        callback();
      }
    }, 1000);
  }

  updateCountdownDisplay() {
    const movimientoActual = this.steps[this.currentStep];
    const mensaje = `➡ MUEVE TU CABEZA HACIA ${movimientoActual.toUpperCase()}`;

    this.showMessage(`${mensaje} (EN ${this.countdown})`, 'info');
  }

  validateMovement(movimientoEsperado: string) {
    console.log('[INICIO] validateMovement');

    if (!this.videoElement) return;

    let startTime = Date.now();

    if (this.movementInterval) {
      clearInterval(this.movementInterval);
    }

    this.movementInterval = setInterval(async () => {
      if (!this.waitingForAction || this.validationFailed) {
        clearInterval(this.movementInterval);
        return;
      }

      const detections = await faceapi.detectSingleFace(this.videoElement!).withFaceLandmarks();

      if (detections) {
        this.drawOverlay(detections.landmarks);

        const esCorrecto = this.getAction(detections, movimientoEsperado);

        if (esCorrecto) {
          console.log(`✅ Movimiento ${movimientoEsperado} detectado correctamente.`);

          this.waitingForAction = false;
          clearInterval(this.movementInterval);

          this.showMessage(`✅ MOVIMIENTO ${movimientoEsperado.toUpperCase()} CORRECTO`, 'success');

          // Aquí incrementamos currentStep
          this.currentStep++;

          setTimeout(() => this.nextStep(), 1500);
        } else if (Date.now() - startTime > 3000) {
          console.log(`❌ Tiempo agotado o movimiento incorrecto`);

          this.waitingForAction = false;
          clearInterval(this.movementInterval);

          this.validationFailed = true;

          this.showMessage('❌ TIEMPO AGOTADO O MOVIMIENTO INCORRECTO.', 'error');
        }
      }
    }, 300);
  }

  getAction(detections: any, movimientoEsperado: string): boolean {
    const landmarks = detections.landmarks;
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    const noseTipX = nose[3].x;
    const noseTipY = nose[3].y;
    const leftJawX = jaw[0].x;
    const rightJawX = jaw[16].x;
    const chinY = jaw[8].y;

    const faceCenterX = (leftJawX + rightJawX) / 2;
    const faceCenterY = chinY;

    const horizontalThreshold = 15;
    const verticalThreshold = 85;
    const acercarseThreshold = 220;

    const faceWidth = rightJawX - leftJawX;

    switch (movimientoEsperado) {
      case 'derecha':
        return noseTipX < faceCenterX - horizontalThreshold;
      case 'izquierda':
        return noseTipX > faceCenterX + horizontalThreshold;
      case 'arriba':
        return noseTipY < faceCenterY - verticalThreshold;
      case 'acercarse':
        return faceWidth > acercarseThreshold;
      default:
        return false;
    }
  }

  drawOverlay(landmarks: faceapi.FaceLandmarks68) {
    if (!this.canvas || !this.videoElement) return;

    const dims = {
      width: this.videoElement.width || 640,
      height: this.videoElement.height || 480
    };

    const resizedLandmarks = faceapi.resizeResults(landmarks, dims);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(this.canvas.width / 2, 0);
    ctx.lineTo(this.canvas.width / 2, this.canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, this.canvas.height / 2);
    ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    ctx.stroke();

    faceapi.draw.drawFaceLandmarks(this.canvas, resizedLandmarks);
  }

  shuffleArray(array: string[]): string[] {
    return array.sort(() => Math.random() - 0.5);
  }

  showMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const cameraOverlay = document.getElementById('camera-overlay');

    if (cameraOverlay) {
      cameraOverlay.innerHTML = message.toUpperCase();

      switch (type) {
        case 'success':
          cameraOverlay.style.backgroundColor = 'rgba(0, 128, 0, 0.7)';
          break;
        case 'error':
          cameraOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
          break;
        default:
          cameraOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      }
    }
  }

  clearIntervals() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.movementInterval) clearInterval(this.movementInterval);
  }
}
