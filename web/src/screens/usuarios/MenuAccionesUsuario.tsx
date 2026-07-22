import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cx } from '../../lib/classNames';
import type { AccionUsuario, ItemMenu } from './acciones';
import styles from './MenuAccionesUsuario.module.css';

const TAMANO_ICONO = 18;

/** Cierra el menú al clickear afuera o con Escape. */
function useCerrarAfuera(abierto: boolean, cerrar: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!abierto) return;
    function alClickear(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) cerrar();
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape') cerrar();
    }
    document.addEventListener('mousedown', alClickear);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alClickear);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto, cerrar, ref]);
}

/** Menú "⋯" de acciones por fila. Las acciones con guard quedan visibles pero
 *  deshabilitadas, con el motivo en el title (nunca ocultas). */
export function MenuAccionesUsuario({
  nombre,
  items,
  onAccion,
}: {
  nombre: string;
  items: ItemMenu[];
  onAccion: (accion: AccionUsuario) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  useCerrarAfuera(abierto, () => setAbierto(false), contenedorRef);

  return (
    <div className={styles.contenedor} ref={contenedorRef}>
      <button
        type="button"
        className={styles.disparador}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Acciones de ${nombre}`}
        onClick={() => setAbierto((previo) => !previo)}
      >
        <MoreHorizontal size={TAMANO_ICONO} aria-hidden />
      </button>
      {abierto && (
        <div role="menu" aria-label={`Acciones de ${nombre}`} className={styles.menu}>
          {items.map((item) => (
            <button
              key={item.accion}
              type="button"
              role="menuitem"
              className={cx(styles.item, item.destructiva && styles.destructiva)}
              disabled={item.motivo !== null}
              title={item.motivo ?? undefined}
              onClick={() => {
                setAbierto(false);
                onAccion(item.accion);
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
