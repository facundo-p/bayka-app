import { Select, type Opcion } from '../../components';
import { etiquetaCodigoNombre } from '../../lib/formato';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';

interface SelectParcelaProps {
  parcelas: ParcelaConStats[];
  value: string;
  onChange: (parcelaId: string) => void;
}

function opcionesParcela(parcelas: ParcelaConStats[]): Array<Opcion<string>> {
  return parcelas.map((parcela) => ({ value: parcela.id, label: etiquetaCodigoNombre(parcela) }));
}

/** Filtro por parcela de las toolbars de Grupos y Árboles. Una parcela de la URL
 *  que ya no existe la suelta la sección, con `useSoltarParcelaFantasma`. */
export function SelectParcela(props: SelectParcelaProps) {
  const { parcelas, value, onChange } = props;
  return (
    <Select
      label="Parcela"
      labelOculto
      value={value}
      onChange={(evento) => onChange(evento.target.value)}
      opciones={opcionesParcela(parcelas)}
    >
      <option value="">Parcela: todas</option>
    </Select>
  );
}
