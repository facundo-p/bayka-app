import type { OpcionConDetalle } from '../opcionesConDetalle';

/** Dos homónimos que solo se distinguen por el email, y uno sin email. */
export const OPCIONES: OpcionConDetalle[] = [
  { valor: 'u4', principal: 'Lucía Ferreyra', secundario: 'lucia@bayka.app' },
  { valor: 'u7', principal: 'Lucía Ferreyra', secundario: 'lferreyra@gmail.com' },
  { valor: 'u8', principal: 'Pablo Ríos', secundario: null },
];
