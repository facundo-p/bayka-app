import { EstadoPlantacionBadge, type TableColumn } from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import type {
  ArbolDetalle,
  GrupoConDetalle,
  ParcelaConStats,
  TipoGrupo,
} from '../../queries/dataExplorerQueries';
import { codigoParcelaDe, nombreTecnicoDe, SIN_DATO } from './arbolFormato';
import { CeldaDescripcion, CeldaEspecie, CeldaFoto, CeldaGps } from './celdas';
import styles from './SeccionesDatos.module.css';

/*
 * Columnas de las tres tablas de la tab Datos. Viven aparte de las secciones
 * para que el test del ocultamiento —nunca se cae la columna de identidad ni
 * la de acciones— las importe sin montar la pantalla.
 */

/* ─── Parcelas ─────────────────────────────────────────────────────────── */

export const COLUMNAS_PARCELAS: Array<TableColumn<ParcelaConStats>> = [
  { key: 'nombre', header: 'Nombre' },
  {
    key: 'codigo',
    header: 'Código',
    render: (parcela) => <span className={styles.codigo}>{parcela.codigo}</span>,
  },
  {
    key: 'descripcion',
    fueraEnMovil: true,
    header: 'Descripción',
    render: (parcela) => <CeldaDescripcion descripcion={parcela.descripcion} />,
  },
  {
    key: 'grupos',
    header: 'Grupos',
    align: 'center',
    render: (parcela) => <span className={styles.numero}>{formatearEntero(parcela.grupos)}</span>,
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'center',
    render: (parcela) => <span className={styles.numero}>{formatearEntero(parcela.arboles)}</span>,
  },
  {
    key: 'createdAt',
    fueraEnMovil: true,
    header: 'Creada',
    render: (parcela) => formatearFechaCorta(parcela.createdAt),
  },
];

/* ─── Grupos ───────────────────────────────────────────────────────────── */

const ETIQUETA_TIPO: Record<TipoGrupo, string> = { linea: 'Línea', bosquete: 'Bosquete' };

export const COLUMNAS_GRUPOS: Array<TableColumn<GrupoConDetalle>> = [
  {
    key: 'codigo',
    header: 'Código',
    render: (grupo) => <span className={styles.codigo}>{grupo.codigo}</span>,
  },
  { key: 'nombre', header: 'Nombre' },
  {
    key: 'parcelaCodigo',
    header: 'Parcela',
    render: (grupo) => <span className={styles.codigo}>{grupo.parcelaCodigo}</span>,
  },
  { key: 'tipo', fueraEnMovil: true, header: 'Tipo', render: (grupo) => ETIQUETA_TIPO[grupo.tipo] },
  {
    key: 'estado',
    header: 'Estado',
    // Grupos y plantaciones comparten los estados activa/finalizada: mismo badge.
    render: (grupo) => <EstadoPlantacionBadge estado={grupo.estado} />,
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'center',
    render: (grupo) => <span className={styles.numero}>{formatearEntero(grupo.arboles)}</span>,
  },
  {
    key: 'createdAt',
    fueraEnMovil: true,
    header: 'Creado',
    render: (grupo) => formatearFechaCorta(grupo.createdAt),
  },
];

/* ─── Árboles ──────────────────────────────────────────────────────────── */

const COLUMNAS_IDENTIDAD_ARBOL: Array<TableColumn<ArbolDetalle>> = [
  {
    key: 'subId',
    header: 'SubID',
    render: (arbol) => <span className={styles.subId}>{arbol.subId}</span>,
  },
  { key: 'especie', header: 'Especie', render: (arbol) => <CeldaEspecie arbol={arbol} /> },
];

const COLUMNAS_REGISTRO_ARBOL: Array<TableColumn<ArbolDetalle>> = [
  {
    key: 'grupo',
    header: 'Grupo',
    render: (arbol) => <span className={styles.codigo}>{arbol.grupoCodigo}</span>,
  },
  {
    key: 'posicion',
    fueraEnMovil: true,
    header: 'Pos.',
    align: 'center',
    render: (arbol) => <span className={styles.numero}>{arbol.posicion ?? SIN_DATO}</span>,
  },
  { key: 'gps', fueraEnMovil: true, fueraConPanel: true, header: 'GPS', render: (arbol) => <CeldaGps arbol={arbol} /> },
  { key: 'foto', fueraEnMovil: true, header: 'Foto', render: (arbol) => <CeldaFoto fotoUrl={arbol.fotoUrl} /> },
  {
    key: 'createdAt',
    fueraEnMovil: true,
    fueraConPanel: true,
    header: 'Registrado',
    render: (arbol) => formatearFechaCorta(arbol.createdAt),
  },
];

function columnaParcela(codigosParcela: Map<string, string>): TableColumn<ArbolDetalle> {
  return {
    key: 'parcela',
    header: 'Parcela',
    render: (arbol) => {
      const codigo = codigoParcelaDe(arbol, codigosParcela);
      return codigo ? <span className={styles.codigo}>{codigo}</span> : SIN_DATO;
    },
  };
}

function columnaTecnico(nombresUsuario: Map<string, string>): TableColumn<ArbolDetalle> {
  return {
    key: 'usuario',
    fueraEnMovil: true,
    fueraConPanel: true,
    header: 'Técnico',
    render: (arbol) => nombreTecnicoDe(arbol, nombresUsuario) ?? SIN_DATO,
  };
}

export function columnasArboles(
  codigosParcela: Map<string, string>,
  nombresUsuario: Map<string, string>,
): Array<TableColumn<ArbolDetalle>> {
  return [
    ...COLUMNAS_IDENTIDAD_ARBOL,
    columnaParcela(codigosParcela),
    ...COLUMNAS_REGISTRO_ARBOL,
    columnaTecnico(nombresUsuario),
  ];
}
