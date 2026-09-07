import { Check, Minus } from 'lucide-react';
import { Input } from './Input';
import { cx } from '../lib/classNames';
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
  busqueda: string;
}

const TITULO_BLOQUEADA = 'Tiene árboles registrados';
const MARCA_BLOQUEADA = 'con árboles';
const LABEL_MAESTRO = 'Marcar todas';
const SIN_RESULTADOS = 'Ninguna especie coincide con la búsqueda';

/** Buscador del checklist; vive en la cabecera de la card, no sobre la lista. */
export function BuscadorEspecies({
  busqueda,
  onBuscar,
}: {
  busqueda: string;
  onBuscar: (texto: string) => void;
}) {
  return (
    <Input
      label="Buscar especie"
      labelOculto
      className={styles.buscador}
      placeholder="Buscar especie…"
      value={busqueda}
      onChange={(event) => onBuscar(event.target.value)}
    />
  );
}

/** Checkbox maestro tri-estado: marca/desmarca todas las visibles a la vez. */
export function MaestroEspecies({
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
      className={styles.maestro}
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
      {LABEL_MAESTRO}
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
        // La fila ya no muestra el nombre científico (no entra en dos columnas):
        // queda en el title, y el buscador lo sigue matcheando.
        title={bloqueada ? TITULO_BLOQUEADA : (especie.nombreCientifico ?? undefined)}
        className={cx(styles.fila, marcada && styles.filaMarcada)}
        onClick={alternar}
      >
        <span className={cx(styles.checkbox, marcada && styles.checkboxMarcado)} aria-hidden>
          {marcada && <Check size={14} strokeWidth={3} />}
        </span>
        <span className={styles.codigo}>{especie.codigo}</span>
        <span className={styles.nombre}>{especie.nombre}</span>
        {bloqueada && <span className={styles.conArboles}>{MARCA_BLOQUEADA}</span>}
      </button>
    </li>
  );
}

/** Lista del checklist en dos columnas; el buscador y el maestro van aparte. */
export function SpeciesChecklist({
  catalogo,
  habilitadas,
  bloqueadas,
  onToggle,
  busqueda,
}: SpeciesChecklistProps) {
  const filtrado = filtrarCatalogo(catalogo, busqueda);
  // Catálogo con especies pero filtro sin coincidencias: aviso claro en vez de
  // una lista vacía muda. Si el catálogo entero está vacío, la lista queda sola.
  if (filtrado.length === 0 && catalogo.length > 0) {
    return (
      <p className={styles.sinResultados} role="status">
        {SIN_RESULTADOS}
      </p>
    );
  }
  return (
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
  );
}
