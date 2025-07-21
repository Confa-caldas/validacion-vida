export interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceLandmarks {
  landmarks: FaceLandmark[];
  nose: FaceLandmark;
  leftEye: {
    top: FaceLandmark;
    bottom: FaceLandmark;
    center: FaceLandmark;
  };
  rightEye: {
    top: FaceLandmark;
    bottom: FaceLandmark;
    center: FaceLandmark;
  };
}

export interface FaceDetectionResult {
  faceLandmarks: FaceLandmarks;
  isCentered: boolean;
  blinkDetected: boolean;
  distanceBetweenEyes: number;
} 