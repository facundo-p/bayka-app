import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../lib/classNames';
import styles from './SegmentedControl.module.css';

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

/** Exige un nombre accesible: aria-label o aria-labelledby (uno u otro). */
type NombreAccesible =
  | { 'aria-label': string; 'aria-labelledby'?: never }
  | { 'aria-labelledby': string; 'aria-label'?: never };

type SegmentedControlProps<T extends string | number> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'sm';
} & NombreAccesible;

/**
 * Selector segmentado genérico (Datos Árboles/Grupos/Parcelas, presets GPS).
 * Sigue el patrón radiogroup de WAI-ARIA: roving-tabindex (solo el radio
 * seleccionado es tabbable) + navegación con flechas ←/→/↑/↓ (con wrap),
 * Home/End, y activación al enfocar. Requiere nombre accesible.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  ...rest
}: SegmentedControlProps<T>) {
  const refBotones = useRef<Array<HTMLButtonElement | null>>([]);

  const indiceSeleccionado = options.findIndex((opcion) => opcion.value === value);
  // Si no hay coincidencia, el primero queda tabbable para no perder el foco.
  const indiceTabbable = indiceSeleccionado >= 0 ? indiceSeleccionado : 0;

  // Selecciona y enfoca el siguiente radio habilitado en la dirección dada (wrap).
  const moverDesde = (desde: number, paso: number) => {
    const total = options.length;
    if (total === 0) return;
    let indice = desde;
    for (let intento = 0; intento < total; intento++) {
      indice = (indice + paso + total) % total;
      if (!options[indice]?.disabled) {
        onChange(options[indice].value);
        refBotones.current[indice]?.focus();
        return;
      }
    }
  };

  const alPresionar = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    switch (evento.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        evento.preventDefault();
        moverDesde(indice, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        evento.preventDefault();
        moverDesde(indice, -1);
        break;
      case 'Home':
        evento.preventDefault();
        moverDesde(-1, 1); // primer habilitado
        break;
      case 'End':
        evento.preventDefault();
        moverDesde(0, -1); // último habilitado (wrap hacia atrás)
        break;
    }
  };

  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-label={rest['aria-label']}
      aria-labelledby={rest['aria-labelledby']}
    >
      {options.map((opcion, indice) => {
        const activo = opcion.value === value;
        return (
          <button
            key={String(opcion.value)}
            ref={(elemento) => {
              refBotones.current[indice] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={indice === indiceTabbable ? 0 : -1}
            disabled={opcion.disabled}
            className={cx(styles.option, size === 'sm' && styles.sm, activo && styles.active)}
            onClick={() => onChange(opcion.value)}
            onKeyDown={(evento) => alPresionar(evento, indice)}
          >
            <span className={styles.label}>{opcion.label}</span>
            {opcion.sublabel && <span className={styles.sublabel}>{opcion.sublabel}</span>}
          </button>
        );
      })}
    </div>
  );
}
