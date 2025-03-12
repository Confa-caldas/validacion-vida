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
    console.clear();
    console.log('[INICIO] Validación de movimientos');

    this.currentStep = 0;
    this.validationFailed = false;
    this.isRunningValidation = true;

    this.steps = this.shuffleArray(['izquierda', 'derecha', 'arriba', 'acercarse']).slice(0, this.maxSteps);
    console.log('🎲 Secuencia de movimientos:', this.steps);

    this.nextStep();
  }

  nextStep() {
    console.log('[INICIO] nextStep()');

    if (this.validationFailed || !this.isRunningValidation) {
      console.warn('⚠️ Validación finalizada o fallida. nextStep cancelado.');
      return;
    }

    if (this.waitingForAction) {
      console.warn('⚠️ Aún esperando un movimiento anterior. nextStep cancelado.');
      return;
    }

    if (this.currentStep >= this.maxSteps) {
      console.log('✅ Todos los pasos completados.');
      this.finalizarValidacion();
      return;
    }

    const pasoActual = this.currentStep + 1;
    const movimientoActual = this.steps[this.currentStep];

    console.log(`➡ Preparando el paso ${pasoActual}/${this.maxSteps}: ${movimientoActual.toUpperCase()}`);

    this.waitingForAction = false;

    this.showMessage('🕑 VUELVE AL CENTRO...', 'info');

    // Tiempo para que el usuario vuelva al centro antes de iniciar el countdown
    setTimeout(() => {
      const mensaje = `➡ MUEVE TU CABEZA HACIA ${movimientoActual.toUpperCase()}`;
      this.showMessage(`${mensaje} (PREPÁRATE)`, 'info');

      this.startCountdown(() => {
        if (this.waitingForAction) {
          console.warn('⚠️ Aún esperando otro movimiento. No iniciamos nueva validación.');
          return;
        }

        console.log(`🚦 Iniciando validación de: ${movimientoActual}`);
        this.showMessage(`${mensaje} AHORA`, 'info');

        this.waitingForAction = true;

        // Pequeño delay antes de empezar a validar (opcional, para estabilidad)
        setTimeout(() => {
          this.validateMovement(movimientoActual);
        }, 500);
      });
    }, 1000);
  }

  finalizarValidacion() {
    console.log('[INICIO] finalizarValidacion()');

    if (!this.isRunningValidation) {
      console.warn('⚠️ La validación ya se había finalizado.');
      return;
    }

    this.isRunningValidation = false;
    this.waitingForAction = false;
    this.clearIntervals();

    this.showMessage('✅ VALIDACIÓN EXITOSA.', 'success');
    console.log(`🎉 Validación completada: ${this.currentStep}/${this.maxSteps}`);
  }

  startCountdown(callback: () => void) {
    this.countdown = 3;
    this.updateCountdownDisplay();

    if (this.countdownInterval) clearInterval(this.countdownInterval);

    console.log(`⏳ Iniciando countdown de ${this.countdown} segundos...`);

    this.countdownInterval = setInterval(() => {
      this.countdown--;

      if (this.countdown > 0) {
        this.updateCountdownDisplay();
      } else {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;

        console.log('🚀 Countdown finalizado. Llamando callback...');
        callback();
      }
    }, 1000);
  }

  updateCountdownDisplay() {
    const movimientoActual = this.steps[this.currentStep];
    const mensaje = `➡ MUEVE TU CABEZA HACIA ${movimientoActual.toUpperCase()}`;

    console.log(`📣 ${mensaje} (EN ${this.countdown})`);
    this.showMessage(`${mensaje} (EN ${this.countdown})`, 'info');
  }

  validateMovement(movimientoEsperado: string) {
    console.log(`[INICIO] validateMovement() - Esperando movimiento: ${movimientoEsperado}`);

    if (!this.videoElement) {
      console.error('❌ No hay videoElement disponible.');
      return;
    }

    let startTime = Date.now();

    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }

    this.movementInterval = setInterval(async () => {
      if (!this.waitingForAction || this.validationFailed) {
        console.warn('⛔ Cancelando validación. No se espera acción o ya falló.');
        clearInterval(this.movementInterval!);
        this.movementInterval = null;
        return;
      }

      const detections = await faceapi.detectSingleFace(this.videoElement!).withFaceLandmarks();

      if (detections) {
        const esCorrecto = this.getAction(detections, movimientoEsperado);

        if (esCorrecto) {
          console.log(`✅ Movimiento ${movimientoEsperado} detectado correctamente.`);

          // Cortamos de inmediato para evitar doble validación
          this.waitingForAction = false;
          clearInterval(this.movementInterval!);
          this.movementInterval = null;

          this.showMessage(`✅ MOVIMIENTO ${movimientoEsperado.toUpperCase()} CORRECTO`, 'success');

          this.currentStep++;

          // Tiempo antes de pasar al siguiente paso
          setTimeout(() => {
            console.log('➡ Avanzando al siguiente paso...');
            this.nextStep();
          }, 1000);

          return; // 🚀 IMPORTANTE: salir del interval
        } else if (Date.now() - startTime > 3000) {
          console.log(`❌ Tiempo agotado o movimiento incorrecto (${movimientoEsperado})`);

          this.waitingForAction = false;
          this.validationFailed = true;

          clearInterval(this.movementInterval!);
          this.movementInterval = null;

          this.showMessage('❌ TIEMPO AGOTADO O MOVIMIENTO INCORRECTO.', 'error');

          // Puedes finalizar el proceso aquí si es necesario
        }
      } else {
        console.warn('❗ No se detectó rostro en la imagen.');
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
    const verticalThreshold = 80;
    const acercarseThreshold = 200;

    const faceWidth = rightJawX - leftJawX;

    console.log('🔍 Valores detectados:', {
      noseTipX,
      noseTipY,
      faceCenterX,
      faceCenterY,
      faceWidth
    });

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

    console.log(`[MENSAJE] ${message} (${type})`);
  }

  clearIntervals() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
      console.log('🛑 Countdown detenido.');
    }

    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
      console.log('🛑 Movimiento detenido.');
    }
  }

  capturePhotoBase64(): string | null {
    const video: HTMLVideoElement = document.getElementById('webcam') as HTMLVideoElement;
    if (!video) {
      console.error('No se encontró el elemento de video');
      return null;
    }
  
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    const context = canvas.getContext('2d');
    if (!context) {
      console.error('No se pudo obtener el contexto del canvas');
      return null;
    }
  
    // Dibuja el frame actual del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    // Convierte el canvas a imagen base64
    const base64Image = canvas.toDataURL('image/jpeg', 0.9); // 90% calidad
  
    console.log('📸 Imagen capturada en base64:', base64Image);
    return base64Image;
  }

}
