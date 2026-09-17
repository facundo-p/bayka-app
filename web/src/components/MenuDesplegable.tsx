import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/classNames';
import { useCerrarAfuera } from '../hooks/useCerrarAfuera';
import styles from './MenuDesplegable.module.css';

export interface ItemDesplegable {
  clave: string;
  etiqueta: string;
  onSeleccionar: () => void;
  /** null/undefined = habilitado; texto = por qué no lo está (visible en title). */
  motivo?: string | null;
  destructiva?: boolean;
}

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

/** Menú flotante anclado a un disparador: cierra al clickear afuera o con Escape. */
export function MenuDesplegable({ etiqueta, disparador, items }: MenuDesplegableProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  useCerrarAfuera(abierto, cerrar, contenedorRef);

  return (
    <div className={styles.contenedor} ref={contenedorRef}>
      {disparador({
        'aria-haspopup': 'menu',
        'aria-expanded': abierto,
        'aria-label': etiqueta,
        onClick: () => setAbierto((previo) => !previo),
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
              onClick={() => {
                cerrar();
                item.onSeleccionar();
              }}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
