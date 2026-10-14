import { FileDown } from 'lucide-react';
import { Button } from '../../components';
import { TAMANO_ICONO } from '../../theme/iconos';
import { TEXTO_REPORTE_PDF } from './textosReportePdf';
import type { EstadoReportePdf } from './useReportePdf';
import styles from './BotonReportePdf.module.css';

/**
 * «Reporte PDF» de la barra de Árboles. Solo el botón: el estado y el modal van
 * fuera de la barra, que se rearma al cruzar el ancho de teléfono.
 */
export function BotonReportePdf({ reporte }: { reporte: EstadoReportePdf }) {
  return (
    <Button
      variant="contorno"
      size="sm"
      className={styles.boton}
      disabled={!reporte.disponible}
      title={TEXTO_REPORTE_PDF.botonDescripcion}
      onClick={reporte.abrir}
    >
      <FileDown size={TAMANO_ICONO.md} aria-hidden />
      <span className={styles.etiqueta}>{TEXTO_REPORTE_PDF.boton}</span>
    </Button>
  );
}
