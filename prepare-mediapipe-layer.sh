#!/bin/bash

# Script para preparar layer de MediaPipe para AWS Lambda
# Ejecutar desde la raíz del proyecto

echo "🔧 Preparando layer de MediaPipe para AWS Lambda..."

# Crear directorio del layer
mkdir -p lambda-layer/nodejs

# Instalar MediaPipe en el layer
cd lambda-layer/nodejs
npm init -y
npm install @mediapipe/tasks-vision canvas

# Crear archivo de configuración para el layer
cat > package.json << EOF
{
  "name": "mediapipe-layer",
  "version": "1.0.0",
  "description": "MediaPipe layer for AWS Lambda",
  "main": "index.js",
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.22-rc.20250304",
    "canvas": "^2.11.2"
  }
}
EOF

# Descargar modelos de MediaPipe
mkdir -p models
cd models

# Descargar modelo de detección facial
curl -O https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

# Crear archivo de configuración para MediaPipe
cat > face_landmarker.task << EOF
{
  "modelFile": "face_landmarker.tflite",
  "modelFileChecksum": "face_landmarker.tflite",
  "modelFileSize": "face_landmarker.tflite"
}
EOF

echo "✅ Layer de MediaPipe preparado en lambda-layer/"
echo "📁 Estructura creada:"
echo "   lambda-layer/"
echo "   └── nodejs/"
echo "       ├── node_modules/"
echo "       ├── models/"
echo "       └── package.json"

echo ""
echo "🚀 Para desplegar:"
echo "1. sam build"
echo "2. sam deploy --guided" 