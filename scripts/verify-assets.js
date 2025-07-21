const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist/camara-video-validacion/assets/modelos');
const distAssetsPath = path.join(__dirname, '../dist/camara-video-validacion/assets');
const distRootPath = path.join(__dirname, '../dist/camara-video-validacion');

const requiredFiles = [
  'vision_wasm_internal.wasm',
  'vision_wasm_internal.js',
  'face_landmarker.task',
  'face_landmark_68_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'ssd_mobilenetv1_model-weights_manifest.json'
];

console.log('🔍 Verificando archivos de MediaPipe...');
console.log('📁 Buscando en:', distPath);

// Verificar si el directorio raíz existe
if (!fs.existsSync(distRootPath)) {
  console.error('❌ El directorio raíz de distribución no existe:', distRootPath);
  process.exit(1);
}

// Verificar si el directorio assets existe
if (!fs.existsSync(distAssetsPath)) {
  console.error('❌ El directorio assets no existe:', distAssetsPath);
  console.log('📂 Contenido del directorio raíz:');
  try {
    const rootContents = fs.readdirSync(distRootPath);
    rootContents.forEach(item => {
      const itemPath = path.join(distRootPath, item);
      const stats = fs.statSync(itemPath);
      console.log(`  ${item} - ${stats.isDirectory() ? 'DIR' : 'FILE'}`);
    });
  } catch (error) {
    console.error('❌ Error al leer directorio raíz:', error.message);
  }
  process.exit(1);
}

// Verificar si el directorio modelos existe
if (!fs.existsSync(distPath)) {
  console.error('❌ El directorio modelos no existe:', distPath);
  console.log('📂 Contenido del directorio assets:');
  try {
    const assetsContents = fs.readdirSync(distAssetsPath);
    assetsContents.forEach(item => {
      const itemPath = path.join(distAssetsPath, item);
      const stats = fs.statSync(itemPath);
      console.log(`  ${item} - ${stats.isDirectory() ? 'DIR' : 'FILE'}`);
    });
  } catch (error) {
    console.error('❌ Error al leer directorio assets:', error.message);
  }
  process.exit(1);
}

console.log('✅ Directorio modelos encontrado');

let missingFiles = [];
let foundFiles = [];

for (const file of requiredFiles) {
  const filePath = path.join(distPath, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} - ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    foundFiles.push(file);
  } else {
    console.error(`❌ ${file} - NO ENCONTRADO`);
    missingFiles.push(file);
  }
}

console.log(`\n📊 Resumen:`);
console.log(`✅ Archivos encontrados: ${foundFiles.length}/${requiredFiles.length}`);
console.log(`❌ Archivos faltantes: ${missingFiles.length}`);

if (missingFiles.length > 0) {
  console.error('\n❌ Archivos faltantes:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  process.exit(1);
} else {
  console.log('\n🎉 Todos los archivos están presentes y correctos!');
} 