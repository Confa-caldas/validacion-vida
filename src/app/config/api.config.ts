export const API_CONFIG = {
  BASE_URL: 'https://lo3llmhfb0.execute-api.us-east-1.amazonaws.com/PY/pruebadevida',
  API_KEY: 'C4Vq8h3L1r9nxz1fKDSoR4kaaL59ks2E8axGpXSG',
  HEADERS: {
    'Content-Type': 'application/json',
    'X-API-KEY': 'C4Vq8h3L1r9nxz1fKDSoR4kaaL59ks2E8axGpXSG'
  }
} as const;

export const VALIDATION_CONFIG = {
  REQUIRED_BLINKS: 2,
  MOVEMENT_TIMEOUT: 10000, // 10 segundos (antes eran 6)
  PREPARATION_COUNTDOWN: 3,
  CENTER_THRESHOLD: 0.05,
  BLINK_THRESHOLD: 0.005,
  ZOOM_THRESHOLD: 1.2,
  // Configuración específica para cada movimiento
  MOVEMENT_THRESHOLDS: {
    ARRIBA: 0.35,      // Más suave que 0.40
    ABAJO: 0.65,       // Más suave que 0.60
    IZQUIERDA: 0.65,   // Más suave que 0.60
    DERECHA: 0.35,     // Más suave que 0.40
    ACERCARSE: 1.15    // Más suave que 1.2
  }
} as const; 