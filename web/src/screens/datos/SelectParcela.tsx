import { Select } from '../../components';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';

interface SelectParcelaProps {
  parcelas: ParcelaConStats[];
  value: string;
  onChange: (parcelaId: string) => void;
}

/** Filtro por parcela compartido por las secciones Grupos y Árboles. */
export function SelectParcela({ parcelas, value, onChange }: SelectParcelaProps) {
  return (
    <Select label="Parcela" value={value} onChange={(evento) => onChange(evento.target.value)}>
      <option value="">Todas las parcelas</option>
      {parcelas.map((parcela) => (
        <option key={parcela.id} value={parcela.id}>
          {`${parcela.codigo} — ${parcela.nombre}`}
        </option>
      ))}
    </Select>
  );
}
