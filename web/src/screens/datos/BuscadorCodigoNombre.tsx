import { CampoBusqueda } from '../../components';

interface BuscadorCodigoNombreProps {
  value: string;
  onChange: (texto: string) => void;
}

/** Buscador de Parcelas y Grupos; la búsqueda global lo llena al elegir una fila. */
export function BuscadorCodigoNombre({ value, onChange }: BuscadorCodigoNombreProps) {
  return (
    <CampoBusqueda
      densidad="compacta"
      label="Buscar por código o nombre"
      placeholder="Buscar por código o nombre…"
      value={value}
      onChange={onChange}
    />
  );
}
