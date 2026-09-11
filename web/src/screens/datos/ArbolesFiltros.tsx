import { CampoBusqueda, Select, type Opcion } from '../../components';
import { etiquetaCodigoNombre } from '../../lib/formato';
import type { EspecieCatalogo } from '../../queries/especieQueries';
import type { GrupoConDetalle, ParcelaConStats } from '../../queries/dataExplorerQueries';
import { ESPECIE_NO_RESUELTA, ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
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

type Enlace = Pick<ArbolesFiltrosProps, 'filtros' | 'onCambiar'>;

interface SelectFiltroProps extends Enlace {
  campo: keyof FiltrosUi;
  label: string;
  className: string;
  opciones: ReadonlyArray<Opcion<string>>;
  disabled?: boolean;
  title?: string;
}

const SELECT_GPS = {
  campo: 'gps',
  label: 'GPS',
  className: styles.filtroGps,
  opciones: [
    { value: FILTRO_GPS.todos, label: 'GPS: todos' },
    { value: FILTRO_GPS.con, label: 'Con GPS' },
    { value: FILTRO_GPS.sin, label: 'Sin GPS' },
  ],
} as const;

const SELECT_FOTO = {
  campo: 'foto',
  label: 'Foto',
  className: styles.filtroFoto,
  opciones: [
    { value: FILTRO_FOTO.todas, label: 'Foto: todas' },
    { value: FILTRO_FOTO.con, label: 'Con foto' },
    { value: FILTRO_FOTO.sin, label: 'Sin foto' },
  ],
} as const;

const SELECT_ESPECIE = {
  campo: 'speciesId',
  label: 'Especie',
  className: styles.filtroEspecie,
} as const;

function opcionesEspecie(especies: EspecieCatalogo[]): Array<Opcion<string>> {
  return [
    { value: '', label: 'Especie: todas' },
    { value: ESPECIE_SIN_IDENTIFICAR, label: `${ESPECIE_NO_RESUELTA} (sin identificar)` },
    ...especies.map((especie) => ({ value: especie.id, label: etiquetaCodigoNombre(especie) })),
  ];
}

function opcionesGrupo(grupos: GrupoConDetalle[]): Array<Opcion<string>> {
  return [
    { value: '', label: 'Grupo: todos' },
    ...grupos.map((grupo) => ({ value: grupo.id, label: grupo.codigo })),
  ];
}

/** Select de la fila de filtros: label oculto y el valor atado a un campo de la URL. */
function SelectFiltro({ campo, filtros, onCambiar, ...select }: SelectFiltroProps) {
  return (
    <Select
      labelOculto
      value={filtros[campo]}
      onChange={(evento) => onCambiar(campo, evento.target.value)}
      {...select}
    />
  );
}

function FiltroGrupo({ grupos, ...enlace }: Enlace & { grupos: GrupoConDetalle[] }) {
  // Un grupo solo acota dentro de una parcela: sin parcela no hay qué listar.
  // Se habilita igual si la URL trae un grupo, para no dejar un filtro activo
  // que no se pueda ver ni quitar.
  const habilitado = Boolean(enlace.filtros.parcelaId || enlace.filtros.groupId);
  return (
    <SelectFiltro
      campo="groupId"
      label="Grupo"
      className={styles.filtroGrupo}
      opciones={opcionesGrupo(grupos)}
      disabled={!habilitado}
      title={habilitado ? undefined : 'Elegí una parcela para filtrar por grupo'}
      {...enlace}
    />
  );
}

interface BusquedaYParcelaProps extends Enlace {
  parcelas: ParcelaConStats[];
}

function BusquedaYParcela({ parcelas, filtros, onCambiar }: BusquedaYParcelaProps) {
  return (
    <>
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
    </>
  );
}

/** Filtros del listado de árboles, en línea dentro de la toolbar. Con seis
 *  controles la fila envuelve en pantallas angostas. */
export function ArbolesFiltros({ parcelas, grupos, especies, ...enlace }: ArbolesFiltrosProps) {
  return (
    <div className={styles.filtrosCompactos}>
      <BusquedaYParcela parcelas={parcelas} {...enlace} />
      <FiltroGrupo grupos={grupos} {...enlace} />
      <SelectFiltro {...SELECT_ESPECIE} opciones={opcionesEspecie(especies)} {...enlace} />
      <SelectFiltro {...SELECT_GPS} {...enlace} />
      <SelectFiltro {...SELECT_FOTO} {...enlace} />
    </div>
  );
}
