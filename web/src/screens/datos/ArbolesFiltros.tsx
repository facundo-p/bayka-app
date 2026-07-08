import { Input, Select } from '../../components';
import type { EspecieCatalogo } from '../../queries/especieQueries';
import { ESPECIE_SIN_IDENTIFICAR, type ParcelaConStats } from '../../queries/dataExplorerQueries';
import { GPS_CON, GPS_SIN, type FiltrosUi } from './filtrosArboles';
import styles from './SeccionesDatos.module.css';

interface ArbolesFiltrosProps {
  filtros: FiltrosUi;
  parcelas: ParcelaConStats[];
  especies: EspecieCatalogo[];
  onCambiar: (campo: keyof FiltrosUi, valor: string) => void;
}

/**
 * Filtros compactos del listado de árboles, en línea dentro de la toolbar:
 * búsqueda + Parcela + Especie + GPS. Labels accesibles pero ocultos.
 * El scope por Grupo (drill-down) se gestiona vía ScopeChips, no acá.
 */
export function ArbolesFiltros({ filtros, parcelas, especies, onCambiar }: ArbolesFiltrosProps) {
  return (
    <div className={styles.filtrosCompactos}>
      <Input
        label="Buscar por ID o SubID"
        labelOculto
        className={styles.busqueda}
        placeholder="Buscar por ID o SubID…"
        value={filtros.busqueda}
        onChange={(evento) => onCambiar('busqueda', evento.target.value)}
      />
      <Select
        label="Parcela"
        labelOculto
        value={filtros.parcelaId}
        onChange={(evento) => onCambiar('parcelaId', evento.target.value)}
      >
        <option value="">Parcela: todas</option>
        {parcelas.map((parcela) => (
          <option key={parcela.id} value={parcela.id}>
            {`${parcela.codigo} — ${parcela.nombre}`}
          </option>
        ))}
      </Select>
      <Select
        label="Especie"
        labelOculto
        value={filtros.speciesId}
        onChange={(evento) => onCambiar('speciesId', evento.target.value)}
      >
        <option value="">Especie: todas</option>
        <option value={ESPECIE_SIN_IDENTIFICAR}>N/N (sin identificar)</option>
        {especies.map((especie) => (
          <option key={especie.id} value={especie.id}>
            {`${especie.codigo} — ${especie.nombre}`}
          </option>
        ))}
      </Select>
      <Select
        label="GPS"
        labelOculto
        value={filtros.gps}
        onChange={(evento) => onCambiar('gps', evento.target.value)}
      >
        <option value="">GPS: todos</option>
        <option value={GPS_CON}>Con GPS</option>
        <option value={GPS_SIN}>Sin GPS</option>
      </Select>
    </div>
  );
}
