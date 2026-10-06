import { useState } from 'react';
import { Button } from '../../components';
import { useDescarga } from '../../hooks/useDescarga';
import { useEnfocarAlMontar } from '../../hooks/useEnfocarAlMontar';
import { textoGenerarFichas, textoSeleccion } from './seleccionFichas';
import type { SeleccionFichas } from './useSeleccionFichas';
import styles from './BarraSeleccionFichas.module.css';

const TEXTO_BARRA = {
  region: 'Árboles seleccionados',
  cancelar: 'Cancelar',
  generando: 'Generando fichas…',
  error: 'No se pudieron generar las fichas',
} as const;

/** Descarga de las fichas; el error es de esa selección y se borra cuando cambia. */
function useDescargaFichas(seleccion: SeleccionFichas) {
  const descarga = useDescarga(async () => {
    await seleccion.generar?.();
    return null;
  }, TEXTO_BARRA.error);
  const claveIds = seleccion.ids.join();
  const [claveVista, setClaveVista] = useState(claveIds);
  if (claveVista !== claveIds) {
    setClaveVista(claveIds);
    descarga.limpiarMensaje();
  }
  return descarga;
}

type Descarga = ReturnType<typeof useDescargaFichas>;

/** Mientras genera no se puede cancelar: la descarga ya está en curso. */
function BotonesBarra({ seleccion, descarga }: { seleccion: SeleccionFichas; descarga: Descarga }) {
  return (
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
        {descarga.descargando ? TEXTO_BARRA.generando : textoGenerarFichas(seleccion.ids.length)}
      </Button>
    </div>
  );
}

/** Franja del modo selección, bajo los filtros (#755). */
export function BarraSeleccionFichas({ seleccion }: { seleccion: SeleccionFichas }) {
  const descarga = useDescargaFichas(seleccion);
  // «Seleccionar» se desmonta al entrar: el foco pasa a la franja y no se pierde.
  const ref = useEnfocarAlMontar<HTMLDivElement>(seleccion.focoEnFranja, seleccion.focoTomado);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={styles.barra}
      role="region"
      aria-label={TEXTO_BARRA.region}
    >
      <span className={styles.cuenta} aria-live="polite">
        {textoSeleccion(seleccion.ids.length, seleccion.totalPagina)}
      </span>
      {descarga.mensaje && (
        <span className={styles.error} role="alert">
          {descarga.mensaje}
        </span>
      )}
      <BotonesBarra seleccion={seleccion} descarga={descarga} />
    </div>
  );
}
