import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { restaurarAncho } from './test/simularAncho';

// Sin stub, todo componente que decida qué renderizar por ancho explota al montarse.
// Los tests con entorno node (el render del PDF) no tienen ventana que simular.
if (typeof window !== 'undefined') {
  restaurarAncho();
  afterEach(restaurarAncho);
}
