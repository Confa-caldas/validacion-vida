export const MOVEMENTS = {
  LEFT: 'izquierda',
  RIGHT: 'derecha',
  UP: 'arriba',
  DOWN: 'abajo',
  ZOOM: 'acercarse'
} as const;

export const MOVEMENT_LIST = [
  MOVEMENTS.LEFT,
  MOVEMENTS.RIGHT,
  MOVEMENTS.UP,
  MOVEMENTS.DOWN,
  MOVEMENTS.ZOOM
] as const;

export const STATUS_MESSAGES = {
  READY: 'Presiona "Validar" para comenzar.',
  PREPARING: '🔄 Preparando validación...',
  CENTER_FACE: '🕒 Alinea el rostro al centro...',
  PREPARE_MOVEMENT: '🎯 Prepárate para realizar el movimiento: "{movement}"',
  PREPARE_FACIAL_GESTURE: '🎯 Prepárate para realizar el gesto facial: "{gesture}"',
  PERFORM_MOVEMENT: '🎬 ¡Ahora realiza el movimiento: "{movement}"!',
  PERFORM_FACIAL_GESTURE: '🎬 ¡Ahora realiza el gesto facial: "{gesture}"!',
  MOVEMENT_COMPLETED: '✅ Movimiento "{movement}" completado correctamente',
  FACIAL_GESTURE_COMPLETED: '✅ Gesto facial "{gesture}" completado correctamente',
  RETURN_TO_CENTER: '🔄 Ahora vuelve al centro y prepárate para el {nextType}: "{nextAction}"',
  RETURN_TO_CENTER_COUNTDOWN: '⏰ Vuelve al centro ({countdown}s) y prepárate para "{nextAction}"',
  CENTER_CONFIRMED: '✅ Centrado confirmado. Prepárate para el {nextType}: "{nextAction}"',
  CENTER_CONTINUE: '🕒 Alinea el rostro al centro para continuar...',
  VALIDATION_COMPLETE: '📤 Validación de movimientos completada. Enviando resultados...',
  VALIDATION_FAILED: '❌ Validación fallida: {message}. Intenta de nuevo.',
  ERROR_SERVER: '⚠️ Error al validar con el servidor.',
  WAITING_RESULT: '⏳ Validando información... esperando resultado final del backend.'
} as const;

export const CANVAS_CONFIG = {
  DESKTOP_WIDTH: 640,
  DESKTOP_HEIGHT: 480,
  MOBILE_ASPECT_RATIO: 0.75
} as const;

// Función helper para formatear mensajes de validación
export function formatValidationMessage(template: string, params: Record<string, string>): string {
  let message = template;
  
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{${key}}`;
    message = message.replace(placeholder, value);
  }
  
  return message;
} 