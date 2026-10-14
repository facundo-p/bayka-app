import { CampoBusqueda, Select, type Opcion } from '../../components';
import { etiquetaCodigoNombre } from '../../lib/formato';
import type { EspecieCatalogo } from '../../queries/especieQueries';
import type { GrupoConDetalle, ParcelaConStats } from '../../queries/dataExplorerQueries';
import { ESPECIE_NO_RESUELTA, ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { FILTRO_FOTO, FILTRO_GPS, type FiltrosUi } from './filtrosArboles';
import { SelectParcela } from './SelectParcela';

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
  opciones: ReadonlyArray<Opcion<string>>;
  disabled?: boolean;
  title?: string;
}

const SELECT_GPS = {
  campo: 'gps',
  label: 'GPS',
  opciones: [
    { value: FILTRO_GPS.todos, label: 'GPS: todos' },
    { value: FILTRO_GPS.con, label: 'Con GPS' },
    { value: FILTRO_GPS.sin, label: 'Sin GPS' },
  ],
} as const;

const SELECT_FOTO = {
  campo: 'foto',
  label: 'Foto',
  opciones: [
    { value: FILTRO_FOTO.todas, label: 'Foto: todas' },
    { value: FILTRO_FOTO.con, label: 'Con foto' },
    { value: FILTRO_FOTO.sin, label: 'Sin foto' },
  ],
} as const;

const SELECT_ESPECIE = {
  campo: 'speciesId',
  label: 'Especie',
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

/** Select de filtro: label oculto y el valor atado a un campo de la URL. */
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
      opciones={opcionesGrupo(grupos)}
      disabled={!habilitado}
      title={habilitado ? undefined : 'Elegí una parcela para filtrar por grupo'}
      {...enlace}
    />
  );
}

/** Buscador de Árboles: va a la vista en la barra, no al panel de filtros. */
export function BuscadorArboles({ filtros, onCambiar }: Enlace) {
  return (
    <CampoBusqueda
      densidad="minima"
      // El placeholder nombra solo el SubID para entrar en el ancho mínimo.
      label="Buscar por SubID o ID Árbol"
      placeholder="Buscar SubID…"
      value={filtros.busqueda}
      onChange={(texto) => onCambiar('busqueda', texto)}
    />
  );
}

/** Filtros del listado de árboles, para el panel de filtros de la toolbar. */
export function ArbolesFiltros({ parcelas, grupos, especies, ...enlace }: ArbolesFiltrosProps) {
  return (
    <>
      <SelectParcela
        parcelas={parcelas}
        value={enlace.filtros.parcelaId}
        onChange={(valor) => enlace.onCambiar('parcelaId', valor)}
      />
      <FiltroGrupo grupos={grupos} {...enlace} />
      <SelectFiltro {...SELECT_ESPECIE} opciones={opcionesEspecie(especies)} {...enlace} />
      <SelectFiltro {...SELECT_GPS} {...enlace} />
      <SelectFiltro {...SELECT_FOTO} {...enlace} />
    </>
  );
}
