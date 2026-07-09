import { Check, Minus } from 'lucide-react';
import { Input } from './Input';
import { cx } from '../lib/classNames';
import { colorEspeciePorCodigo } from '../theme/coloresEspecie';
import { filtrarCatalogo, type EstadoMaestro } from '../lib/speciesChecklistSelection';
import type { EspecieCatalogo } from '../queries/especieQueries';
import styles from './SpeciesChecklist.module.css';

interface SpeciesChecklistProps {
  catalogo: EspecieCatalogo[];
  /** Ids de especies habilitadas en la plantación. */
  habilitadas: Set<string>;
  /** Habilitadas que no se pueden desmarcar (tienen árboles registrados). */
  bloqueadas?: Set<string>;
  onToggle: (speciesId: string, habilitar: boolean) => void;
  /** Tri-estado del maestro sobre las filas visibles (lo calcula el contenedor). */
  estadoMaestro: EstadoMaestro;
  /** Marca/desmarca todas las filas visibles. */
  onMaestro: () => void;
  busqueda: string;
  onBuscar: (texto: string) => void;
}

const TITULO_BLOQUEADA = 'Tiene árboles registrados';
const LABEL_MAESTRO = 'Todas las especies';
const SIN_RESULTADOS = 'Ninguna especie coincide con la búsqueda';

/** Checkbox maestro tri-estado: marca/desmarca todas las visibles a la vez. */
function MaestroTodas({
  estado,
  deshabilitado,
  onMaestro,
}: {
  estado: EstadoMaestro;
  deshabilitado: boolean;
  onMaestro: () => void;
}) {
  const marcada = estado === 'todas';
  const parcial = estado === 'parcial';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={parcial ? 'mixed' : marcada}
      aria-label={LABEL_MAESTRO}
      disabled={deshabilitado}
      className={cx(styles.fila, styles.filaMaestra)}
      onClick={onMaestro}
    >
      <span
        className={cx(styles.checkbox, (marcada || parcial) && styles.checkboxMarcado)}
        aria-hidden
      >
        {parcial ? (
          <Minus size={14} strokeWidth={3} />
        ) : (
          marcada && <Check size={14} strokeWidth={3} />
        )}
      </span>
      <span className={styles.nombreMaestra}>{LABEL_MAESTRO}</span>
    </button>
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
  estadoMaestro,
  onMaestro,
  busqueda,
  onBuscar,
}: SpeciesChecklistProps) {
  const filtrado = filtrarCatalogo(catalogo, busqueda);
  // Catálogo con especies pero filtro sin coincidencias: aviso claro en vez de
  // una lista vacía muda. Si el catálogo entero está vacío, la lista queda sola.
  const sinResultados = filtrado.length === 0 && catalogo.length > 0;
  return (
    <div className={styles.contenedor}>
      <Input
        label="Buscar especie"
        labelOculto
        placeholder="Buscar especie por nombre o código…"
        value={busqueda}
        onChange={(event) => onBuscar(event.target.value)}
      />
      <MaestroTodas
        estado={estadoMaestro}
        deshabilitado={filtrado.length === 0}
        onMaestro={onMaestro}
      />
      {sinResultados ? (
        <p className={styles.sinResultados} role="status">
          {SIN_RESULTADOS}
        </p>
      ) : (
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
      )}
    </div>
  );
}
