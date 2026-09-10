import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { restaurarAncho } from './test/simularAncho';

// Sin stub, todo componente que decida qué renderizar por ancho explota al montarse.
restaurarAncho();
afterEach(restaurarAncho);
