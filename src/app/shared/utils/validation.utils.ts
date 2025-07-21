import { MOVEMENT_LIST } from '../../config/constants';

export class ValidationUtils {

  /**
   * Genera un ID de sesión único
   */
  static generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  /**
   * Mezcla aleatoriamente un array
   */
  static shuffleArray<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Genera una secuencia aleatoria de movimientos
   */
  static generateRandomMovementSequence(count: number = 3): string[] {
    return this.shuffleArray([...MOVEMENT_LIST]).slice(0, count);
  }

  /**
   * Valida que un movimiento sea válido
   */
  static isValidMovement(movement: string): boolean {
    return MOVEMENT_LIST.includes(movement as any);
  }

  /**
   * Formatea un mensaje de estado con variables
   */
  static formatStatusMessage(message: string, variables: Record<string, string> = {}): string {
    let formattedMessage = message;
    Object.entries(variables).forEach(([key, value]) => {
      formattedMessage = formattedMessage.replace(`{${key}}`, value);
    });
    return formattedMessage;
  }
} 