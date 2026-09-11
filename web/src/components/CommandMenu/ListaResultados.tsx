import { Cargando } from '../Cargando';
import { SeccionPaleta } from './SeccionPaleta';
import { AVISO_VACIO, type AvisoVacio, type ContenidoPaleta } from './useSeccionesCommandMenu';
import type { ListboxPaleta } from './useListboxPaleta';
import styles from './CommandMenu.module.css';

const MENSAJE_VACIO = {
  sinResultados: (texto: string) => `Sin resultados para “${texto}”.`,
  nadaQueSugerir: 'Todavía no hay recientes ni plantaciones para sugerir.',
} as const;

interface ListaResultadosProps {
  contenido: ContenidoPaleta;
  texto: string;
  listbox: ListboxPaleta;
}

function AvisoListaVacia({ aviso, texto }: { aviso: AvisoVacio; texto: string }) {
  if (aviso === AVISO_VACIO.cargando) return <Cargando />;
  const mensaje =
    aviso === AVISO_VACIO.sinResultados
      ? MENSAJE_VACIO.sinResultados(texto)
      : MENSAJE_VACIO.nadaQueSugerir;
  return <p className={styles.vacio}>{mensaje}</p>;
}

export function ListaResultados({ contenido, texto, listbox }: ListaResultadosProps) {
  const { secciones, avisoVacio } = contenido;
  return (
    <div {...listbox.propsLista()} aria-label="Resultados" className={styles.lista}>
      {secciones.map((seccion) => (
        <SeccionPaleta
          key={seccion.clave}
          seccion={seccion}
          propsOpcion={listbox.propsOpcion}
          onElegir={listbox.elegir}
        />
      ))}
      {avisoVacio && <AvisoListaVacia aviso={avisoVacio} texto={texto} />}
    </div>
  );
}
