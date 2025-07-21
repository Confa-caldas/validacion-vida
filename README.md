# Sistema de Validación de Vida (Liveness Detection)

Sistema avanzado de autenticación biométrica que utiliza detección facial en tiempo real para verificar que una persona real está presente frente a la cámara.

## 🎯 Características

- **Detección facial en tiempo real** usando MediaPipe Tasks Vision
- **Validación de movimientos** (izquierda, derecha, arriba, abajo, acercarse)
- **Detección de parpadeos** para verificar vida
- **Interfaz responsiva** para desktop y móvil
- **Arquitectura modular** siguiendo mejores prácticas de Angular

## 🏗️ Arquitectura del Proyecto

```
validacion-vida/
├── src/
│   ├── app/
│   │   ├── core/                    # 🎯 Servicios core y modelos
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts           # Comunicación con backend
│   │   │   │   ├── camera.service.ts        # Control de cámara
│   │   │   │   └── face-detection.service.ts # Detección facial
│   │   │   └── models/
│   │   │       ├── face-landmarks.interface.ts
│   │   │       ├── validation-result.interface.ts
│   │   │       └── api-response.interface.ts
│   │   ├── shared/                  # 🎯 Utilidades compartidas
│   │   │   └── utils/
│   │   │       ├── canvas.utils.ts          # Utilidades de canvas
│   │   │       ├── face-detection.utils.ts  # Utilidades de detección
│   │   │       └── validation.utils.ts      # Utilidades de validación
│   │   ├── features/                # 🎯 Módulos de características
│   │   │   └── liveness-detection/
│   │   │       ├── components/
│   │   │       │   └── liveness-detection.component.ts
│   │   │       ├── services/
│   │   │       │   └── liveness-detection.service.ts
│   │   │       └── models/
│   │   │           ├── movement.interface.ts
│   │   │           └── validation-state.interface.ts
│   │   └── config/                  # 🎯 Configuración centralizada
│   │       ├── api.config.ts
│   │       └── constants.ts
│   └── assets/
│       └── modelos/                  # 🎯 Modelos de IA MediaPipe
```

## 🚀 Instalación y Ejecución

### Prerrequisitos
- Node.js 18+
- Angular CLI 19+

### Instalación
```bash
npm install
```

### Desarrollo
```bash
npm start
```
La aplicación estará disponible en `http://localhost:4200/`

### Build de Producción
```bash
npm run build
```

### Tests
```bash
npm test
```

## 🔧 Tecnologías Utilizadas

- **Frontend**: Angular 19
- **IA/ML**: MediaPipe Tasks Vision (Google)
- **Detección facial**: Face Landmarker con 468 puntos
- **Backend**: API REST en AWS Lambda
- **Lenguajes**: TypeScript, JavaScript

## 📋 Funcionalidades

### 1. Inicialización
- Activación de cámara frontal
- Carga del modelo MediaPipe
- Generación de ID de sesión único

### 2. Proceso de Validación
1. **Centrado del rostro** - Guía visual para alinear la cara
2. **Secuencia de movimientos** - 3 movimientos aleatorios
3. **Verificación de parpadeos** - Mínimo 2 parpadeos
4. **Captura de foto** - Imagen para análisis

### 3. Análisis en Tiempo Real
- **468 puntos faciales** analizados continuamente
- Detección de posición de nariz, ojos y puntos clave
- Cálculo de distancias y movimientos
- Verificación de movimientos naturales

## 🛡️ Seguridad

- **Detección de spoofing** - Previene ataques con fotos/videos
- **Movimientos aleatorios** - Cada sesión es diferente
- **Análisis biométrico** - Verifica características únicas
- **Comunicación segura** - API con autenticación por clave

## 🧪 Testing

### Tests Unitarios
```bash
npm test
```

### Tests Específicos
```bash
# Tests de servicios
npm test -- --include="**/services/**/*.spec.ts"

# Tests de utilidades
npm test -- --include="**/utils/**/*.spec.ts"
```

## 📊 Casos de Uso

- **Bancos digitales** - Verificación de identidad
- **Aplicaciones de gobierno** - Documentos oficiales
- **Plataformas de trabajo remoto** - Verificación de presencia
- **Sistemas de seguridad** - Autenticación biométrica

## 🔄 Flujo de Validación

```
1. Usuario inicia cámara
   ↓
2. Sistema carga modelo MediaPipe
   ↓
3. Usuario inicia validación
   ↓
4. Sistema genera secuencia aleatoria
   ↓
5. Usuario centra rostro
   ↓
6. Sistema valida 3 movimientos + parpadeos
   ↓
7. Sistema envía datos al backend
   ↓
8. Backend retorna resultado final
```

## 🎨 Interfaz de Usuario

- **Guías visuales** - Círculos azules indican movimientos
- **Mensajes de estado** - Información clara del progreso
- **Diseño responsivo** - Funciona en desktop y móvil
- **Espejo** - Imagen reflejada para mejor UX

## 📈 Métricas de Rendimiento

- **Tiempo de carga del modelo**: ~2-3 segundos
- **Latencia de detección**: <100ms por frame
- **Precisión de detección**: >95%
- **Tiempo total de validación**: ~30-45 segundos

## 🐛 Solución de Problemas

### Error: "No se pudo acceder a la cámara"
- Verificar permisos del navegador
- Asegurar que no hay otras aplicaciones usando la cámara
- Probar en modo incógnito

### Error: "No se pudo cargar el modelo"
- Verificar conexión a internet
- Limpiar caché del navegador
- Verificar que los archivos de modelo estén presentes

### Error: "Error al validar con el servidor"
- Verificar conexión a internet
- Verificar que la API esté disponible
- Revisar logs del navegador para más detalles

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Para soporte técnico o preguntas sobre el proyecto, contacta al equipo de desarrollo.
