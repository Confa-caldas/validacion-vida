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

// Rutas para archivos de MediaPipe - Usando CDN oficial
export const MEDIAPIPE_CONFIG = {
  BASE_PATH: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  WASM_FILE: 'vision_wasm_internal.wasm',
  FACE_LANDMARKER_TASK: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  FACE_LANDMARK_MODEL: 'face_landmark_68_model-shard1',
  FACE_LANDMARK_MANIFEST: 'face_landmark_68_model-weights_manifest.json',
  SSD_MODEL_SHARD1: 'ssd_mobilenetv1_model-shard1',
  SSD_MODEL_SHARD2: 'ssd_mobilenetv1_model-shard2',
  SSD_MANIFEST: 'ssd_mobilenetv1_model-weights_manifest.json'
} as const;

// Función helper para obtener la ruta completa de un archivo
export function getMediaPipeAssetPath(filename: string): string {
  // Si el archivo ya es una URL completa, devolverla tal como está
  if (filename.startsWith('http')) {
    return filename;
  }
  
  // Si es el archivo WASM, usar el CDN de MediaPipe
  if (filename === MEDIAPIPE_CONFIG.WASM_FILE) {
    return `${MEDIAPIPE_CONFIG.BASE_PATH}/${filename}`;
  }
  
  // Para otros archivos, usar la ruta base
  return `${MEDIAPIPE_CONFIG.BASE_PATH}/${filename}`;
} 