import { MOVEMENT_LIST } from '../../config/constants';
import { GestosDisponibles } from '../../core/services/api.service';

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
   * Mezcla aleatoriamente un array usando el algoritmo Fisher-Yates
   */
  static shuffleArray<T>(array: T[]): T[] {
    const copy = [...array];
    console.log('🔄 Mezclando array:', copy);
    
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      console.log(`   🔀 Intercambiando posición ${i} con ${j}: ${copy[i]} ↔ ${copy[j]}`);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    
    console.log('✅ Array mezclado:', copy);
    return copy;
  }

  /**
   * Mezcla aleatoriamente un array con semilla basada en múltiples fuentes
   */
  static shuffleArrayWithMultiSourceSeed<T>(array: T[]): T[] {
    const copy = [...array];
    const timestamp = Date.now();
    const randomSeed = Math.random() * 1000000;
    const performanceSeed = performance.now() * 1000;
    const combinedSeed = (timestamp + randomSeed + performanceSeed) % 1000000;
    
    console.log('🔄 Mezclando array con semilla múltiple:', copy, 'Semilla:', combinedSeed);
    
    // Usar el algoritmo Fisher-Yates con semilla múltiple
    for (let i = copy.length - 1; i > 0; i--) {
      // Generar número aleatorio usando múltiples fuentes
      const randomValue = Math.sin(combinedSeed + i + timestamp + randomSeed) * 10000000;
      const j = Math.floor(Math.abs(randomValue)) % (i + 1);
      
      console.log(`   🔀 Intercambiando posición ${i} con ${j}: ${copy[i]} ↔ ${copy[j]}`);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    
    console.log('✅ Array mezclado con semilla múltiple:', copy);
    return copy;
  }

  /**
   * Genera una secuencia aleatoria de movimientos usando la lista local
   */
  static generateRandomMovementSequence(count: number = 3): string[] {
    return this.shuffleArray([...MOVEMENT_LIST]).slice(0, count);
  }

  /**
   * Genera una secuencia aleatoria de gestos usando los datos del backend
   */
  static generateRandomGestureSequence(gestosDisponibles: GestosDisponibles, count: number = 3): string[] {
    console.log('🎲 Generando secuencia mixta de gestos...');
    console.log('   📋 Gestos de movimiento:', gestosDisponibles.gestos_movimiento);
    console.log('   😊 Gestos faciales:', gestosDisponibles.gestos_faciales);
    console.log('   🔢 Cantidad solicitada:', count);
    
    // Combinar todos los gestos disponibles
    const todosLosGestos = [
      ...gestosDisponibles.gestos_movimiento,
      ...gestosDisponibles.gestos_faciales
    ];
    
    console.log('   🔄 Total de gestos disponibles:', todosLosGestos.length);
    console.log('   📋 Lista completa:', todosLosGestos);
    
    // Usar método con semilla múltiple para máxima aleatoriedad
    const shuffled = this.shuffleArrayWithMultiSourceSeed([...todosLosGestos]);
    const result = shuffled.slice(0, count);
    
    console.log('✅ Secuencia mixta generada:', result);
    
    // Mostrar qué tipo de gesto es cada uno
    result.forEach((gesto, index) => {
      const esMovimiento = gestosDisponibles.gestos_movimiento.includes(gesto);
      const tipo = esMovimiento ? '🎯 Movimiento' : '😊 Facial';
      console.log(`      ${index + 1}. ${gesto} (${tipo})`);
    });
    
    return result;
  }

  /**
   * Prueba la aleatoriedad generando múltiples secuencias
   */
  static testRandomness(gestosDisponibles: GestosDisponibles, iterations: number = 5): void {
    console.log('🧪 Probando aleatoriedad...');
    console.log('   📊 Iteraciones:', iterations);
    
    for (let i = 0; i < iterations; i++) {
      console.log(`\n🔄 Iteración ${i + 1}:`);
      const sequence = this.generateRandomGestureSequence(gestosDisponibles, 3);
      console.log(`   ✅ Secuencia mixta ${i + 1}:`, sequence);
    }
  }
} 