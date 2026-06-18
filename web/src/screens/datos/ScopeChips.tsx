import styles from './ScopeChips.module.css';

export interface ScopeChip {
  /** Texto de la etiqueta, ej. "Parcela A-01". */
  etiqueta: string;
  /** Quita este filtro del scope. */
  onQuitar: () => void;
}

interface ScopeChipsProps {
  chips: ScopeChip[];
}

/** Fila liviana que muestra el scope activo (parcela/grupo) y deja limpiarlo. */
export function ScopeChips({ chips }: ScopeChipsProps) {
  if (chips.length === 0) return null;
  return (
    <div className={styles.fila} aria-label="Filtros activos">
      {chips.map((chip) => (
        <span key={chip.etiqueta} className={styles.chip}>
          {chip.etiqueta}
          <button
            type="button"
            className={styles.quitar}
            aria-label={`Quitar ${chip.etiqueta}`}
            onClick={chip.onQuitar}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
