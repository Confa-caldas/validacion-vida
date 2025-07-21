export interface LivenessValidationState {
  isActive: boolean;
  currentPhase: 'idle' | 'centering' | 'preparing' | 'validating' | 'completed' | 'failed';
  currentMovement?: string;
  movementsCompleted: string[];
  blinksDetected: number;
  requiredBlinks: number;
  sessionId: string;
  statusMessage: string;
  errorMessage?: string;
}

export interface ValidationPhase {
  name: string;
  duration: number;
  description: string;
} 