import { useEffect } from 'react';
import { Select, type Opcion } from '../../components';
import { etiquetaCodigoNombre } from '../../lib/formato';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';

interface SelectParcelaProps {
  parcelas: ParcelaConStats[];
  value: string;
  onChange: (parcelaId: string) => void;
  className?: string;
}

/**
 * Un `parcela=<id>` en la URL que no existe entre las opciones (p. ej. de otra
 * plantación) dejaría el select en una opción fantasma vacía; se resetea a
 * "todas". Solo con parcelas ya cargadas, para no limpiar durante la carga.
 */
function useResetIdFantasma({ parcelas, value, onChange }: SelectParcelaProps) {
  const idFantasma = value !== '' && !parcelas.some((parcela) => parcela.id === value);
  useEffect(() => {
    if (parcelas.length > 0 && idFantasma) onChange('');
  }, [parcelas.length, idFantasma, onChange]);
}

function opcionesParcela(parcelas: ParcelaConStats[]): Array<Opcion<string>> {
  return parcelas.map((parcela) => ({ value: parcela.id, label: etiquetaCodigoNombre(parcela) }));
}

/** Filtro por parcela de las toolbars de Grupos y Árboles. */
export function SelectParcela(props: SelectParcelaProps) {
  const { parcelas, value, onChange, className } = props;
  useResetIdFantasma(props);
  return (
    <Select
      label="Parcela"
      labelOculto
      className={className}
      value={value}
      onChange={(evento) => onChange(evento.target.value)}
      opciones={opcionesParcela(parcelas)}
    >
      <option value="">Parcela: todas</option>
    </Select>
  );
}
