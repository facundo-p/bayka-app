import { Button } from '../../components';
import { useDescarga } from '../../hooks/useDescarga';
import { textoGenerarFichas, textoSeleccion } from './seleccionFichas';
import type { SeleccionFichas } from './useSeleccionFichas';
import styles from './BarraSeleccionFichas.module.css';

const TEXTO_BARRA = {
  region: 'Árboles seleccionados',
  cancelar: 'Cancelar',
  generando: 'Generando fichas…',
  error: 'No se pudieron generar las fichas',
} as const;

/**
 * Franja del modo selección, bajo los filtros (#755). Cancelar sale del modo;
 * mientras genera no se puede cancelar: la descarga ya está en curso.
 */
export function BarraSeleccionFichas({ seleccion }: { seleccion: SeleccionFichas }) {
  const descarga = useDescarga(async () => {
    await seleccion.generar?.();
    return null;
  }, TEXTO_BARRA.error);
  const cantidad = seleccion.ids.length;
  return (
    <div className={styles.barra} role="region" aria-label={TEXTO_BARRA.region}>
      <span className={styles.cuenta} aria-live="polite">
        {textoSeleccion(cantidad, seleccion.totalPagina)}
      </span>
      {descarga.mensaje && <span className={styles.error}>{descarga.mensaje}</span>}
      <div className={styles.botones}>
        <Button
          variant="inversoSutil"
          size="sm"
          disabled={descarga.descargando}
          onClick={seleccion.cancelar}
        >
          {TEXTO_BARRA.cancelar}
        </Button>
        <Button
          variant="inverso"
          size="sm"
          loading={descarga.descargando}
          disabled={!seleccion.generar}
          onClick={descarga.descargar}
        >
          {descarga.descargando ? TEXTO_BARRA.generando : textoGenerarFichas(cantidad)}
        </Button>
      </div>
    </div>
  );
}
