import { ValidationUtils } from './validation.utils';
import { MOVEMENT_LIST } from '../../config/constants';

describe('ValidationUtils', () => {

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const sessionId1 = ValidationUtils.generateSessionId();
      const sessionId2 = ValidationUtils.generateSessionId();

      expect(sessionId1).toBeTruthy();
      expect(sessionId2).toBeTruthy();
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe('shuffleArray', () => {
    it('should shuffle array elements', () => {
      const originalArray = [1, 2, 3, 4, 5];
      const shuffledArray = ValidationUtils.shuffleArray([...originalArray]);

      expect(shuffledArray).toHaveSize(originalArray.length);
      expect(shuffledArray).toEqual(jasmine.arrayContaining(originalArray));
      // Note: In rare cases, shuffled might equal original, but probability is very low
    });

    it('should handle empty array', () => {
      const result = ValidationUtils.shuffleArray([]);
      expect(result).toEqual([]);
    });

    it('should handle single element array', () => {
      const result = ValidationUtils.shuffleArray([1]);
      expect(result).toEqual([1]);
    });
  });

  describe('generateRandomMovementSequence', () => {
    it('should generate sequence with default count', () => {
      const sequence = ValidationUtils.generateRandomMovementSequence();
      expect(sequence).toHaveSize(3);
      sequence.forEach(movement => {
        expect(MOVEMENT_LIST).toContain(movement as any);
      });
    });

    it('should generate sequence with custom count', () => {
      const sequence = ValidationUtils.generateRandomMovementSequence(2);
      expect(sequence).toHaveSize(2);
      sequence.forEach(movement => {
        expect(MOVEMENT_LIST).toContain(movement as any);
      });
    });

    it('should not exceed available movements', () => {
      const sequence = ValidationUtils.generateRandomMovementSequence(10);
      expect(sequence).toHaveSize(MOVEMENT_LIST.length);
    });
  });

  describe('isValidMovement', () => {
    it('should validate correct movements', () => {
      MOVEMENT_LIST.forEach(movement => {
        expect(ValidationUtils.isValidMovement(movement)).toBe(true);
      });
    });

    it('should reject invalid movements', () => {
      const invalidMovements = ['invalid', 'test', 'random'];
      invalidMovements.forEach(movement => {
        expect(ValidationUtils.isValidMovement(movement)).toBe(false);
      });
    });
  });

  describe('formatStatusMessage', () => {
    it('should format message with variables', () => {
      const message = 'Prepárate para "{movement}" en {countdown}...';
      const variables = { movement: 'izquierda', countdown: '3' };
      const result = ValidationUtils.formatStatusMessage(message, variables);

      expect(result).toBe('Prepárate para "izquierda" en 3...');
    });

    it('should return original message when no variables', () => {
      const message = 'Test message';
      const result = ValidationUtils.formatStatusMessage(message);
      expect(result).toBe(message);
    });

    it('should handle empty variables object', () => {
      const message = 'Test message';
      const result = ValidationUtils.formatStatusMessage(message, {});
      expect(result).toBe(message);
    });

    it('should handle partial variable replacement', () => {
      const message = 'Prepárate para "{movement}"';
      const variables = { movement: 'derecha' };
      const result = ValidationUtils.formatStatusMessage(message, variables);
      expect(result).toBe('Prepárate para "derecha"');
    });
  });
}); 