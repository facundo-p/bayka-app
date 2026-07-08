import { Check } from 'lucide-react';
import { Input } from './Input';
import { cx } from '../lib/classNames';
import { colorEspeciePorCodigo } from '../theme/coloresEspecie';
import type { EspecieCatalogo } from '../queries/especieQueries';
import styles from './SpeciesChecklist.module.css';

interface SpeciesChecklistProps {
  catalogo: EspecieCatalogo[];
  /** Ids de especies habilitadas en la plantación. */
  habilitadas: Set<string>;
  /** Habilitadas que no se pueden desmarcar (tienen árboles registrados). */
  bloqueadas?: Set<string>;
  onToggle: (speciesId: string, habilitar: boolean) => void;
  busqueda: string;
  onBuscar: (texto: string) => void;
}

const TITULO_BLOQUEADA = 'Tiene árboles registrados';

/** Filtra el catálogo por nombre/código/científico, sin distinguir mayúsculas. */
function filtrarCatalogo(catalogo: EspecieCatalogo[], busqueda: string): EspecieCatalogo[] {
  const texto = busqueda.trim().toLowerCase();
  if (!texto) return catalogo;
  return catalogo.filter((especie) =>
    [especie.nombre, especie.codigo, especie.nombreCientifico ?? '']
      .join(' ')
      .toLowerCase()
      .includes(texto),
  );
}

function FilaEspecie({
  especie,
  marcada,
  bloqueada,
  onToggle,
}: {
  especie: EspecieCatalogo;
  marcada: boolean;
  bloqueada: boolean;
  onToggle: (speciesId: string, habilitar: boolean) => void;
}) {
  const alternar = () => {
    if (!bloqueada) onToggle(especie.id, !marcada);
  };
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={marcada}
        aria-label={especie.nombre}
        disabled={bloqueada}
        title={bloqueada ? TITULO_BLOQUEADA : undefined}
        className={styles.fila}
        onClick={alternar}
      >
        <span className={cx(styles.checkbox, marcada && styles.checkboxMarcado)} aria-hidden>
          {marcada && <Check size={14} strokeWidth={3} />}
        </span>
        <span
          className={styles.punto}
          style={{ backgroundColor: colorEspeciePorCodigo(especie.codigo) }}
          aria-hidden
        />
        <span className={styles.codigo}>{especie.codigo}</span>
        <span className={styles.nombre}>{especie.nombre}</span>
        {especie.nombreCientifico && (
          <span className={styles.cientifico}>{especie.nombreCientifico}</span>
        )}
      </button>
    </li>
  );
}

/** Checklist buscable de especies del catálogo (presentacional). */
export function SpeciesChecklist({
  catalogo,
  habilitadas,
  bloqueadas,
  onToggle,
  busqueda,
  onBuscar,
}: SpeciesChecklistProps) {
  const filtrado = filtrarCatalogo(catalogo, busqueda);
  return (
    <div className={styles.contenedor}>
      <Input
        label="Buscar especie"
        labelOculto
        placeholder="Buscar especie por nombre o código…"
        value={busqueda}
        onChange={(event) => onBuscar(event.target.value)}
      />
      <ul className={styles.lista}>
        {filtrado.map((especie) => (
          <FilaEspecie
            key={especie.id}
            especie={especie}
            marcada={habilitadas.has(especie.id)}
            bloqueada={bloqueadas?.has(especie.id) ?? false}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  );
}
