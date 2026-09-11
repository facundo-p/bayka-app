import { SeccionPaleta } from './SeccionPaleta';
import type { ContenidoPaleta } from './useSeccionesCommandMenu';
import type { ListboxPaleta } from './useListboxPaleta';
import styles from './CommandMenu.module.css';

interface ListaResultadosProps {
  contenido: ContenidoPaleta;
  texto: string;
  listbox: ListboxPaleta;
}

export function ListaResultados({ contenido, texto, listbox }: ListaResultadosProps) {
  const { secciones, itemsPlanos } = contenido;
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
      {itemsPlanos.length === 0 && <p className={styles.vacio}>Sin resultados para “{texto}”.</p>}
    </div>
  );
}
