import type { Sustantivo } from './formato';

/** Sustantivos de dominio que cuentan los recuentos de varias pantallas. */
export const SUSTANTIVO = {
  arbol: { singular: 'árbol', plural: 'árboles' },
  especie: { singular: 'especie', plural: 'especies' },
  especieCientifica: { singular: 'especie científica', plural: 'especies científicas' },
  foto: { singular: 'foto', plural: 'fotos' },
  grupo: { singular: 'grupo', plural: 'grupos' },
  hoja: { singular: 'hoja', plural: 'hojas' },
  parcela: { singular: 'parcela', plural: 'parcelas' },
  persona: { singular: 'persona', plural: 'personas' },
  plantacion: { singular: 'plantación', plural: 'plantaciones' },
  punto: { singular: 'punto', plural: 'puntos' },
  tarjetaConFoto: { singular: 'tarjeta con foto', plural: 'tarjetas con foto' },
  temporada: { singular: 'temporada', plural: 'temporadas' },
} as const satisfies Record<string, Sustantivo>;
