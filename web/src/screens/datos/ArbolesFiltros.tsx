import { CampoBusqueda, Select } from '../../components';
import type { EspecieCatalogo } from '../../queries/especieQueries';
import {
  ESPECIE_SIN_IDENTIFICAR,
  type GrupoConDetalle,
  type ParcelaConStats,
} from '../../queries/dataExplorerQueries';
import { FILTRO_FOTO, FILTRO_GPS, type FiltrosUi } from './filtrosArboles';
import { SelectParcela } from './SelectParcela';
import styles from './SeccionesDatos.module.css';

interface ArbolesFiltrosProps {
  filtros: FiltrosUi;
  parcelas: ParcelaConStats[];
  /** Grupos de la parcela elegida; vacío mientras no haya ninguna. */
  grupos: GrupoConDetalle[];
  especies: EspecieCatalogo[];
  onCambiar: (campo: keyof FiltrosUi, valor: string) => void;
}

/**
 * Filtros compactos del listado de árboles, en línea dentro de la toolbar:
 * búsqueda + Parcela + Grupo + Especie + GPS + Foto. Labels accesibles pero
 * ocultos. Con seis controles la fila envuelve en pantallas angostas.
 */
export function ArbolesFiltros({
  filtros,
  parcelas,
  grupos,
  especies,
  onCambiar,
}: ArbolesFiltrosProps) {
  // Un grupo solo acota dentro de una parcela: sin parcela no hay qué listar.
  // Se habilita igual si la URL trae un grupo, para no dejar un filtro activo
  // que no se pueda ver ni quitar.
  const grupoHabilitado = Boolean(filtros.parcelaId || filtros.groupId);
  return (
    <div className={styles.filtrosCompactos}>
      <CampoBusqueda
        densidad="compacta"
        label="Buscar por ID o SubID"
        placeholder="Buscar por ID o SubID…"
        value={filtros.busqueda}
        onChange={(texto) => onCambiar('busqueda', texto)}
      />
      <SelectParcela
        parcelas={parcelas}
        className={styles.filtroParcela}
        value={filtros.parcelaId}
        onChange={(valor) => onCambiar('parcelaId', valor)}
      />
      <Select
        label="Grupo"
        labelOculto
        className={styles.filtroGrupo}
        value={filtros.groupId}
        disabled={!grupoHabilitado}
        title={grupoHabilitado ? undefined : 'Elegí una parcela para filtrar por grupo'}
        onChange={(evento) => onCambiar('groupId', evento.target.value)}
      >
        <option value="">Grupo: todos</option>
        {grupos.map((grupo) => (
          <option key={grupo.id} value={grupo.id}>
            {grupo.codigo}
          </option>
        ))}
      </Select>
      <Select
        label="Especie"
        labelOculto
        className={styles.filtroEspecie}
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
        className={styles.filtroGps}
        value={filtros.gps}
        onChange={(evento) => onCambiar('gps', evento.target.value)}
      >
        <option value={FILTRO_GPS.todos}>GPS: todos</option>
        <option value={FILTRO_GPS.con}>Con GPS</option>
        <option value={FILTRO_GPS.sin}>Sin GPS</option>
      </Select>
      <Select
        label="Foto"
        labelOculto
        className={styles.filtroFoto}
        value={filtros.foto}
        onChange={(evento) => onCambiar('foto', evento.target.value)}
      >
        <option value={FILTRO_FOTO.todas}>Foto: todas</option>
        <option value={FILTRO_FOTO.con}>Con foto</option>
        <option value={FILTRO_FOTO.sin}>Sin foto</option>
      </Select>
    </div>
  );
}
