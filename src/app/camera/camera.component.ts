import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-camera',
  templateUrl: './camera.component.html',
  styleUrls: ['./camera.component.css']
})
export class CameraComponent implements OnInit {
  videoElement: HTMLVideoElement | undefined;
  mediaStream: MediaStream | undefined;
  mediaRecorder: MediaRecorder | undefined;
  recordedChunks: Blob[] = [];

  constructor() {}

  ngOnInit(): void {}

  startCamera(): void {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        this.mediaStream = stream;
        this.videoElement = document.querySelector('video')!;
        this.videoElement.srcObject = stream;
        this.videoElement.play();
      })
      .catch((err) => {
        console.error('Error accessing the camera: ', err);
      });
  }

  startRecording(): void {
    if (this.mediaStream) {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => {
        this.recordedChunks.push(event.data);
      };
      this.mediaRecorder.onstop = () => {
        const videoBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        const videoElement = document.createElement('video');
        videoElement.src = videoUrl;
        videoElement.controls = true;
        document.body.appendChild(videoElement); // Muestra el video grabado
      };
      this.mediaRecorder.start();
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaStream?.getTracks().forEach(track => track.stop());
    }
  }
}