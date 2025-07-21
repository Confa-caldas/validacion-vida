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
  PREPARE_MOVEMENT: 'Prepárate para "{movement}"...',
  PERFORM_MOVEMENT: 'Realiza el movimiento: "{movement}"',
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