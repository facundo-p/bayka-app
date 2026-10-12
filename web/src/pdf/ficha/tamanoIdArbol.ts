import { MEDIDA_FICHA } from '../plantilla/tokens';

/** IBM Plex Mono: todos los glifos miden 0,6 em. */
const ANCHO_GLIFO_MONO = 0.6;

/**
 * El ID Árbol va en un renglón: react-pdf no lo parte en el guion y se
 * metería debajo de la foto. Si a tamaño pleno no entra en la columna, se achica.
 */
export function tamanoIdArbol(idArbol: string): number {
  const entra = MEDIDA_FICHA.anchoTexto / (idArbol.length * ANCHO_GLIFO_MONO);
  return Math.min(MEDIDA_FICHA.letra.idArbol, entra);
}
