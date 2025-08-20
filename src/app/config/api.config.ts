// Configuración para la API de Python (local con Nginx)
export const DETECTION_API_CONFIG = {
  BASE_URL: 'http://localhost',
  ENDPOINTS: {
    GESTOS_DISPONIBLES: '/gestos-disponibles',
    DETECTAR_ROSTRO: '/detectar-rostro/',
    LIMPIAR_SESION: '/limpiar-sesion/'
  },
  FULL_URL: 'http://localhost/detectar-rostro/',
  TIMEOUT: 10000,
  HEADERS: {
    'Content-Type': 'application/json'
  }
};

// Configuración para la Lambda de guardado en BD
export const API_CONFIG = {
  BASE_URL: 'https://ikm6sw4rdl.execute-api.us-east-1.amazonaws.com/pruebadevida',
  HEADERS: {
    'Content-Type': 'application/json'
  }
} as const;

export const VALIDATION_CONFIG = {
  REQUIRED_BLINKS: 2,
  MOVEMENT_TIMEOUT: 10000, // 10 segundos para realizar el movimiento
  CENTER_THRESHOLD: 0.05,
  BLINK_THRESHOLD: 0.005,
  ZOOM_THRESHOLD: 1.2,
  // Configuración específica para cada movimiento (zonas estrictas)
  MOVEMENT_THRESHOLDS: {
    ARRIBA: 0.35,      // Igual al backend
    ABAJO: 0.65,       // Igual al backend
    IZQUIERDA: 0.25,   // Zona izquierda estricta (25% izquierdo)
    DERECHA: 0.75,     // Zona derecha estricta (25% derecho)
    ACERCARSE: 1.15    // Igual al backend
  },
  // Configuración específica para gestos faciales (igualados al backend)
  GESTURE_THRESHOLDS: {
    BOCA_ABIERTA: 0.05,      // Más sensible para detectar aperturas menores
    CEJAS_FRUNCIDAS: 0.08,   // Más exigente para cejas fruncidas
    SONRISA: 0.02,           // Igual al backend
    GUINO: 0.010             // Igual al backend
  }
} as const; 