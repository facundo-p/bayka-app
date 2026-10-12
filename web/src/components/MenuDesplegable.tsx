import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { useDesplegableAnclado } from '../hooks/useDesplegableAnclado';
import styles from './MenuDesplegable.module.css';

export interface ItemDesplegable {
  clave: string;
  etiqueta: string;
  onSeleccionar: () => void;
  /** null/undefined = habilitado; texto = por qué no lo está (visible en title). */
  motivo?: string | null;
  destructiva?: boolean;
}

/** Encuentra el disparador dentro del contenedor por el atributo que le inyecta el menú. */
const SELECTOR_DISPARADOR = '[aria-haspopup="menu"]';

/** Props que el menú inyecta en su disparador; el caller decide qué botón usar. */
export interface PropsDisparador {
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-label': string;
  onClick: () => void;
}

interface MenuDesplegableProps {
  /** Nombre accesible del disparador y del menú. */
  etiqueta: string;
  disparador: (props: PropsDisparador) => ReactNode;
  items: ItemDesplegable[];
}

/**
 * Al desmontarse el ítem elegido el foco cae al body; devolverlo antes al
 * disparador deja a un modal abierto por el ítem un lugar al que volver.
 */
function enfocarDisparador(contenedor: HTMLElement | null) {
  contenedor?.querySelector<HTMLElement>(SELECTOR_DISPARADOR)?.focus();
}

/** Menú flotante anclado a un disparador: cierra al clickear afuera o con Escape. */
export function MenuDesplegable({ etiqueta, disparador, items }: MenuDesplegableProps) {
  const { abierto, cerrar, alternar, contenedorRef } = useDesplegableAnclado();

  function elegir(item: ItemDesplegable) {
    enfocarDisparador(contenedorRef.current);
    cerrar();
    item.onSeleccionar();
  }

  return (
    <div className={styles.contenedor} ref={contenedorRef}>
      {disparador({
        'aria-haspopup': 'menu',
        'aria-expanded': abierto,
        'aria-label': etiqueta,
        onClick: alternar,
      })}
      {abierto && (
        <div role="menu" aria-label={etiqueta} className={styles.menu}>
          {items.map((item) => (
            <button
              key={item.clave}
              type="button"
              role="menuitem"
              className={cx(styles.item, item.destructiva && styles.destructiva)}
              disabled={Boolean(item.motivo)}
              title={item.motivo ?? undefined}
              onClick={() => elegir(item)}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
