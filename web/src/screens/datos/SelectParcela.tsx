import { useEffect } from 'react';
import { Select } from '../../components';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';

interface SelectParcelaProps {
  parcelas: ParcelaConStats[];
  value: string;
  onChange: (parcelaId: string) => void;
  className?: string;
}

/** Filtro por parcela de las toolbars de Grupos y Árboles. */
export function SelectParcela({ parcelas, value, onChange, className }: SelectParcelaProps) {
  // Un `parcela=<id>` en la URL que no existe entre las opciones (p. ej. de otra
  // plantación) dejaría el select en una opción fantasma vacía; lo reseteamos a
  // "todas". Solo con parcelas ya cargadas, para no limpiar durante la carga.
  const idFantasma = value !== '' && !parcelas.some((parcela) => parcela.id === value);
  useEffect(() => {
    if (parcelas.length > 0 && idFantasma) onChange('');
  }, [parcelas.length, idFantasma, onChange]);

  return (
    <Select
      label="Parcela"
      labelOculto
      className={className}
      value={value}
      onChange={(evento) => onChange(evento.target.value)}
    >
      <option value="">Parcela: todas</option>
      {parcelas.map((parcela) => (
        <option key={parcela.id} value={parcela.id}>
          {`${parcela.codigo} — ${parcela.nombre}`}
        </option>
      ))}
    </Select>
  );
}
