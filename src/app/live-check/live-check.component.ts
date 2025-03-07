import { Component, OnInit } from '@angular/core';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-live-check',
  templateUrl: './live-check.component.html',
  styleUrls: ['./live-check.component.css']
})
export class LiveCheckComponent implements OnInit {
  videoElement: any;
  stream: MediaStream | null = null;
  currentStep: number = 0;
  maxSteps = 3;
  waitingForAction = false;
  steps: string[] = [];
  actionText = '';
  lastDetectedAction: string | null = null;
  validationFailed = false;

  ngOnInit(): void {
    this.loadModels();
  }

  async loadModels() {
    await faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights');
    await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights');
    console.log('Modelos cargados');
  }

  startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        this.stream = stream;
        this.videoElement = document.getElementById('video') as HTMLVideoElement;
        this.videoElement.srcObject = stream;
        this.videoElement.play();
      })
      .catch((err) => {
        console.error('Error con la cámara:', err);
      });
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.stream = null;
    console.log("Cámara detenida");
  }

  startMovementValidation() {
    this.currentStep = 0;
    this.waitingForAction = false;
    this.validationFailed = false;

    const movimientos = ['izquierda', 'derecha'];
    this.steps = this.shuffleArray(movimientos);
    this.steps.push('centro'); // Último paso siempre es mirar al frente
    this.nextStep();
  }

  nextStep() {
    if (this.validationFailed) return; // Si falló, no seguir

    if (this.currentStep >= this.maxSteps) {
      this.showMessage('✅ Validación exitosa.');
      return;
    }

    this.waitingForAction = false;
    this.actionText = `➡ Próximo movimiento: ${this.steps[this.currentStep]}`;
    this.showMessage(this.actionText, true);

    setTimeout(() => {
      this.waitingForAction = true;
      this.showMessage(`🔄 Ahora gira la cabeza hacia: ${this.steps[this.currentStep]}`, true);
      this.validateMovement();
    }, 2000);
  }

  validateMovement() {
    if (!this.videoElement) return;

    let startTime = Date.now();
    this.lastDetectedAction = null;

    const interval = setInterval(async () => {
      if (!this.waitingForAction) {
        clearInterval(interval);
        return;
      }

      const detections = await faceapi.detectSingleFace(this.videoElement).withFaceLandmarks();

      if (detections) {
        const action = this.getAction(detections.landmarks);

        if (action !== this.lastDetectedAction) {
          this.lastDetectedAction = action;
        }

        this.showMessage(`🔄 Moviendo cabeza hacia: ${action}`, true);

        if (action === this.steps[this.currentStep]) {
          clearInterval(interval);
          this.showMessage(`✅ Movimiento correcto: ${action}`);
          this.currentStep++;
          setTimeout(() => this.nextStep(), 3000);
        } else if (Date.now() - startTime > 6000) {
          clearInterval(interval);
          this.validationFailed = true;
          this.showMessage('❌ Validación fallida. Reinicia el proceso.');
        }
      }
    }, 500);
  }

  getAction(landmarks: faceapi.FaceLandmarks68): string {
    const nose = landmarks.getNose();
    const jaw = landmarks.getJawOutline();

    const noseTip = nose[3].x;
    const leftJaw = jaw[0].x;
    const rightJaw = jaw[16].x;
    const faceCenter = (leftJaw + rightJaw) / 2;
    const threshold = 25;

    // 🔄 Corrección del modo espejo:
    if (noseTip > faceCenter + threshold) return 'derecha'; // Ajustado al modo espejo
    if (noseTip < faceCenter - threshold) return 'izquierda'; // Ajustado al modo espejo
    return 'centro';
  }

  shuffleArray(array: string[]): string[] {
    return array.sort(() => Math.random() - 0.5);
  }

  showMessage(message: string, showOnCamera: boolean = false) {
    const messageElement = document.getElementById('message');
    if (messageElement) {
      messageElement.innerHTML = message;
    }

    if (showOnCamera) {
      const cameraOverlay = document.getElementById('camera-overlay');
      if (cameraOverlay) {
        cameraOverlay.innerHTML = message;
      }
    }
  }
}
