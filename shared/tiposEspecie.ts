/**
 * Tipo y subtipo de una especie (#752). Espejo de contracts/tipos-especie.json, que es también el
 * CHECK y el DEFAULT de la base: cambian juntos. El subtipo es solo un dato: no cambia conteos ni
 * textos.
 */
export const TIPO_ESPECIE = { flora: 'flora' } as const;

export type TipoEspecie = (typeof TIPO_ESPECIE)[keyof typeof TIPO_ESPECIE];

export const SUBTIPO_ESPECIE = { arbol: 'arbol', arbusto: 'arbusto' } as const;

export type SubtipoEspecie = (typeof SUBTIPO_ESPECIE)[keyof typeof SUBTIPO_ESPECIE];

export const TIPOS_ESPECIE: {
  subtiposPorTipo: Record<TipoEspecie, readonly SubtipoEspecie[]>;
  porDefecto: { tipo: TipoEspecie; subtipo: SubtipoEspecie };
} = {
  subtiposPorTipo: { [TIPO_ESPECIE.flora]: [SUBTIPO_ESPECIE.arbol, SUBTIPO_ESPECIE.arbusto] },
  porDefecto: { tipo: TIPO_ESPECIE.flora, subtipo: SUBTIPO_ESPECIE.arbol },
};
