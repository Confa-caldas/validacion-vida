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
  movementInterval: any = null;

  countdown: number = 3;
  countdownInterval: any;

  ngOnInit(): void {
    this.loadModels();
  }

  async loadModels() {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights');
    await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights');
    console.log('✅ Modelos cargados');
  }

  startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        this.stream = stream;
        this.videoElement = document.getElementById('video') as HTMLVideoElement;

        if (this.videoElement) {
          this.videoElement.srcObject = stream;
          this.videoElement.play();
          this.createCanvasOverlay();
        }
      })
      .catch((err) => console.error('❌ Error con la cámara:', err));
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
    this.currentStep = 0;
    this.validationFailed = false;

    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }

    this.steps = this.shuffleArray(['izquierda', 'derecha', 'arriba', 'acercarse']).slice(0, this.maxSteps);
    console.log('🎲 Movimientos aleatorios:', this.steps);

    this.nextStep();
  }

  nextStep() {
    if (this.validationFailed) return;

    if (this.currentStep >= this.maxSteps) {
      this.showMessage('✅ Validación exitosa.', 'success');
      return;
    }

    this.waitingForAction = false;

    const movimientoActual = this.steps[this.currentStep];
    const mensaje = `➡ Mueve tu cabeza hacia ${movimientoActual}`;

    this.showMessage(`${mensaje} (Prepárate)`, 'info');

    this.startCountdown(() => {
      this.showMessage(`${mensaje} ahora`, 'info');
      this.waitingForAction = true;
      this.validateMovement();
    });
  }

  startCountdown(callback: () => void) {
    this.countdown = 3;
    this.updateCountdownDisplay();

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
    const mensaje = `➡ Mueve tu cabeza hacia ${movimientoActual}`;

    this.showMessage(`${mensaje} (En ${this.countdown})`, 'info');
  }

  validateMovement() {
    if (!this.videoElement) return;

    let startTime = Date.now();
    const movimientoEsperado = this.steps[this.currentStep];

    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }

    console.log(`🔎 Paso actual: ${this.currentStep + 1}/${this.maxSteps}. Esperando movimiento: ${movimientoEsperado}`);

    this.movementInterval = setInterval(async () => {
      if (!this.waitingForAction) {
        clearInterval(this.movementInterval);
        this.movementInterval = null;
        return;
      }

      const detections = await faceapi.detectSingleFace(this.videoElement!).withFaceLandmarks();

      if (detections) {
        this.drawOverlay(detections.landmarks);

        const esCorrecto = this.getAction(detections, movimientoEsperado);

        if (esCorrecto) {
          console.log(`✅ Movimiento ${movimientoEsperado} detectado correctamente.`);

          clearInterval(this.movementInterval);
          this.movementInterval = null;
          this.waitingForAction = false;

          this.showMessage(`✅ Movimiento ${movimientoEsperado} correcto`, 'success');

          this.currentStep++;

          // Espera antes de pasar al siguiente paso
          setTimeout(() => this.nextStep(), 1500);
        } else if (Date.now() - startTime > 3000) {
          console.log(`❌ Tiempo agotado o movimiento incorrecto en: ${movimientoEsperado}`);

          clearInterval(this.movementInterval);
          this.movementInterval = null;
          this.waitingForAction = false;
          this.validationFailed = true;

          this.showMessage('❌ Tiempo agotado o movimiento incorrecto.', 'error');
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

    // Umbrales de sensibilidad
    const horizontalThreshold = 15;  // izquierda/derecha
    const verticalThreshold = 80;    // levantar cabeza
    const acercarseThreshold = 250;  // acercar cara

    const faceWidth = rightJawX - leftJawX;

    // Detectar SOLO el movimiento que toca en este paso
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
      width: this.videoElement.width,
      height: this.videoElement.height
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
      const formattedMessage = message.charAt(0).toUpperCase() + message.slice(1);
      cameraOverlay.innerHTML = formattedMessage;

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
}
