export interface Movement {
  type: 'izquierda' | 'derecha' | 'arriba' | 'abajo' | 'acercarse';
  threshold: number;
  description: string;
}

export interface MovementValidation {
  movement: Movement;
  detected: boolean;
  timestamp: Date;
  confidence: number;
} 