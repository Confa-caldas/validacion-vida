export interface ValidationRequest {
  identificador: string;
  intento: number;
  tipoMovimiento: string;
  exitoso: boolean;
  timestamp: string;
  fotoBase64: string;
  parpadeos: number;
}

export interface ValidationResponse {
  score?: number;
  estadoFinal?: string;
  message?: string;
  success?: boolean;
  exitosos?: number;
  totalParpadeos?: number;
}

export interface ValidationState {
  isInProgress: boolean;
  currentStep: number;
  totalSteps: number;
  movementsCompleted: string[];
  blinksDetected: number;
  requiredBlinks: number;
  sessionId: string;
  statusMessage: string;
} 