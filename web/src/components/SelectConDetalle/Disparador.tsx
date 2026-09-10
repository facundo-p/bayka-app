import { cx } from '../../lib/classNames';
import type { OpcionConDetalle } from './opcionesConDetalle';
import { TextoOpcion } from './TextoOpcion';
import type { Desplegable } from './useDesplegable';
import styles from './SelectConDetalle.module.css';

interface DisparadorProps {
  desplegable: Desplegable;
  placeholder: string;
  invalido: boolean;
}

interface ValorElegidoProps {
  id: string;
  elegida: OpcionConDetalle | undefined;
  placeholder: string;
}

function ValorElegido({ id, elegida, placeholder }: ValorElegidoProps) {
  return (
    <span id={id} className={styles.valor}>
      {elegida ? (
        <TextoOpcion
          opcion={elegida}
          clasePrincipal={styles.valorPrincipal}
          claseSecundario={styles.valorSecundario}
        />
      ) : (
        <span className={styles.placeholder}>{placeholder}</span>
      )}
    </span>
  );
}

export function Disparador({ desplegable, placeholder, invalido }: DisparadorProps) {
  const { abierto, abrir, cerrar, ids } = desplegable;
  return (
    <button
      ref={desplegable.refDisparador}
      id={ids.disparador}
      type="button"
      className={cx(styles.disparador, invalido && styles.disparadorError)}
      aria-haspopup="listbox"
      aria-expanded={abierto}
      aria-controls={abierto ? desplegable.listbox.idLista : undefined}
      aria-labelledby={`${ids.label} ${ids.valor}`}
      aria-invalid={invalido || undefined}
      onClick={abierto ? cerrar : abrir}
      onKeyDown={desplegable.alTeclearDisparador}
    >
      <ValorElegido id={ids.valor} elegida={desplegable.elegida} placeholder={placeholder} />
    </button>
  );
}
