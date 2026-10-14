import { FileDown } from 'lucide-react';
import { Button } from '../../components';
import { useDescarga } from '../../hooks/useDescarga';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './ArbolDetallePanel.module.css';

const TEXTO_FICHA_PDF = {
  boton: 'Descargar ficha PDF',
  generando: 'Generando ficha…',
  error: 'No se pudo generar la ficha',
} as const;

interface BotonFichaPdfProps {
  /** null mientras no cargó la plantación: el botón queda deshabilitado. */
  descargar: (() => Promise<void>) | null;
}

/** Botón ancho del pie del detalle; mientras genera no acepta otro click. */
export function BotonFichaPdf({ descargar }: BotonFichaPdfProps) {
  const descarga = useDescarga(async () => {
    await descargar?.();
    return null;
  }, TEXTO_FICHA_PDF.error);
  return (
    <div className={styles.accionFicha}>
      <Button
        className={styles.botonAncho}
        loading={descarga.descargando}
        disabled={!descargar}
        onClick={descarga.descargar}
      >
        {!descarga.descargando && <FileDown size={TAMANO_ICONO.md} aria-hidden />}
        {descarga.descargando ? TEXTO_FICHA_PDF.generando : TEXTO_FICHA_PDF.boton}
      </Button>
      {descarga.mensaje && <span className={styles.tenue}>{descarga.mensaje}</span>}
    </div>
  );
}
