import type { Sustantivo } from './formato';

/** Sustantivos de dominio que cuentan los recuentos de varias pantallas. */
export const SUSTANTIVO = {
  arbol: { singular: 'árbol', plural: 'árboles' },
  especie: { singular: 'especie', plural: 'especies' },
  grupo: { singular: 'grupo', plural: 'grupos' },
  parcela: { singular: 'parcela', plural: 'parcelas' },
  persona: { singular: 'persona', plural: 'personas' },
  plantacion: { singular: 'plantación', plural: 'plantaciones' },
  temporada: { singular: 'temporada', plural: 'temporadas' },
} as const satisfies Record<string, Sustantivo>;
