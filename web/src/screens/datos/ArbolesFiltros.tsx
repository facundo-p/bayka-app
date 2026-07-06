import { Input, Select } from '../../components';
import type { EspecieCatalogo } from '../../queries/especieQueries';
import {
  ESPECIE_SIN_IDENTIFICAR,
  type GrupoConDetalle,
  type ParcelaConStats,
} from '../../queries/dataExplorerQueries';
import { GPS_CON, GPS_SIN, type FiltrosUi } from './filtrosArboles';
import { SelectParcela } from './SelectParcela';
import styles from './SeccionesDatos.module.css';

interface ArbolesFiltrosProps {
  filtros: FiltrosUi;
  parcelas: ParcelaConStats[];
  grupos: GrupoConDetalle[];
  especies: EspecieCatalogo[];
  onCambiar: (campo: keyof FiltrosUi, valor: string) => void;
}

/** Fila de filtros del listado de árboles. */
export function ArbolesFiltros({
  filtros,
  parcelas,
  grupos,
  especies,
  onCambiar,
}: ArbolesFiltrosProps) {
  return (
    <div className={styles.filtros}>
      <SelectParcela
        parcelas={parcelas}
        value={filtros.parcelaId}
        onChange={(valor) => onCambiar('parcelaId', valor)}
      />
      <Select
        label="Grupo"
        value={filtros.groupId}
        onChange={(evento) => onCambiar('groupId', evento.target.value)}
      >
        <option value="">Todos los grupos</option>
        {grupos.map((grupo) => (
          <option key={grupo.id} value={grupo.id}>
            {grupo.codigo}
          </option>
        ))}
      </Select>
      <Select
        label="Especie"
        value={filtros.speciesId}
        onChange={(evento) => onCambiar('speciesId', evento.target.value)}
      >
        <option value="">Todas las especies</option>
        <option value={ESPECIE_SIN_IDENTIFICAR}>N/N (sin identificar)</option>
        {especies.map((especie) => (
          <option key={especie.id} value={especie.id}>
            {`${especie.codigo} — ${especie.nombre}`}
          </option>
        ))}
      </Select>
      <Select
        label="GPS"
        value={filtros.gps}
        onChange={(evento) => onCambiar('gps', evento.target.value)}
      >
        <option value="">Todos</option>
        <option value={GPS_CON}>Con GPS</option>
        <option value={GPS_SIN}>Sin GPS</option>
      </Select>
      <Input
        label="Buscar por ID"
        value={filtros.busqueda}
        onChange={(evento) => onCambiar('busqueda', evento.target.value)}
      />
    </div>
  );
}
