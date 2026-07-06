import { Button, EmptyState } from '../../components';

interface VacioConFiltrosProps {
  /** Mensaje según la entidad, ej. "Ningún árbol coincide con los filtros". */
  mensaje: string;
  onLimpiar: () => void;
}

/** Estado vacío cuando hay filtros activos: explica el porqué y deja limpiarlos. */
export function VacioConFiltros({ mensaje, onLimpiar }: VacioConFiltrosProps) {
  return (
    <EmptyState title={mensaje}>
      <Button variant="secondary" onClick={onLimpiar}>
        Limpiar filtros
      </Button>
    </EmptyState>
  );
}
