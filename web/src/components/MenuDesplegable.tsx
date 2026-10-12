import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { TECLA } from '../lib/teclas';
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

/** Valor de `aria-haspopup` que el menú inyecta en su disparador. */
const HASPOPUP_MENU = 'menu';
const SELECTOR_DISPARADOR = `[aria-haspopup="${HASPOPUP_MENU}"]`;

/** Props que el menú inyecta en su disparador; el caller decide qué botón usar. */
export interface PropsDisparador {
  'aria-haspopup': typeof HASPOPUP_MENU;
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
 * Cuando el ítem enfocado se desmonta (al elegirlo o al cerrar con Escape) el
 * foco cae al body. Devolverlo antes al disparador conserva el lugar de quien
 * navega con teclado y le da a un modal abierto por el ítem adónde volver.
 */
function enfocarDisparador(contenedor: HTMLElement | null) {
  contenedor?.querySelector<HTMLElement>(SELECTOR_DISPARADOR)?.focus();
}

interface PanelMenuProps {
  etiqueta: string;
  items: ItemDesplegable[];
  onElegir: (item: ItemDesplegable) => void;
  onEscape: () => void;
}

function PanelMenu({ etiqueta, items, onElegir, onEscape }: PanelMenuProps) {
  const alTeclear = (evento: KeyboardEvent) => {
    if (evento.key === TECLA.escape) onEscape();
  };
  return (
    <div role="menu" aria-label={etiqueta} className={styles.menu} onKeyDown={alTeclear}>
      {items.map((item) => (
        <button
          key={item.clave}
          type="button"
          role="menuitem"
          className={cx(styles.item, item.destructiva && styles.destructiva)}
          disabled={Boolean(item.motivo)}
          title={item.motivo ?? undefined}
          onClick={() => onElegir(item)}
        >
          {item.etiqueta}
        </button>
      ))}
    </div>
  );
}

/** Menú flotante anclado a un disparador: cierra al clickear afuera o con Escape. */
export function MenuDesplegable({ etiqueta, disparador, items }: MenuDesplegableProps) {
  const { abierto, cerrar, alternar, contenedorRef } = useDesplegableAnclado();
  const volverAlDisparador = () => enfocarDisparador(contenedorRef.current);

  function elegir(item: ItemDesplegable) {
    volverAlDisparador();
    cerrar();
    item.onSeleccionar();
  }

  return (
    <div className={styles.contenedor} ref={contenedorRef}>
      {disparador({
        'aria-haspopup': HASPOPUP_MENU,
        'aria-expanded': abierto,
        'aria-label': etiqueta,
        onClick: alternar,
      })}
      {abierto && (
        <PanelMenu
          etiqueta={etiqueta}
          items={items}
          onElegir={elegir}
          onEscape={volverAlDisparador}
        />
      )}
    </div>
  );
}
