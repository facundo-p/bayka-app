// Estilos de SpeciesButtonGrid.
import { StyleSheet } from 'react-native';
import { spacing } from '../theme';

export const COLUMNAS_BOTONERA = 3;
const MARGEN_LATERAL = spacing.md;
const SEPARACION = spacing.sm;

export const speciesButtonGridStyles = StyleSheet.create({
  grid: { paddingHorizontal: MARGEN_LATERAL, paddingBottom: spacing.md },
  row: { gap: SEPARACION, marginBottom: spacing.sm },
  cell: { flex: 1 },
});

/** Ancho de una celda con la grilla a lo ancho de la pantalla: la vista previa de Opciones corta los nombres igual. */
export function anchoDeCelda(anchoDePantalla: number): number {
  return (anchoDePantalla - 2 * MARGEN_LATERAL - (COLUMNAS_BOTONERA - 1) * SEPARACION) / COLUMNAS_BOTONERA;
}
