import { EstadoPlantacionBadge, type TableColumn } from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import type {
  ArbolDetalle,
  GrupoConDetalle,
  ParcelaConStats,
  TipoGrupo,
} from '../../queries/dataExplorerQueries';
import { CeldaDescripcion, CeldaEspecie, CeldaFoto, CeldaGps } from './celdas';
import styles from './SeccionesDatos.module.css';

/*
 * Columnas de las tres tablas de la tab Datos, con sus celdas.
 *
 * Viven acá y no en cada sección para que se puedan importar sin arrastrar la
 * pantalla entera: el test que trinquetea las dos reglas duras del ocultamiento
 * —nunca se cae la columna de identidad ni la de acciones— las necesita sueltas.
 * Es además el patrón de las otras tres tablas de la app.
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

/* Etiquetas en español de los tipos de grupo. */
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

export function columnasArboles(
  codigosParcela: Map<string, string>,
  nombresUsuario: Map<string, string>,
): Array<TableColumn<ArbolDetalle>> {
  const columnas: Array<TableColumn<ArbolDetalle>> = [
    {
      key: 'subId',
      header: 'SubID',
      render: (arbol) => <span className={styles.subId}>{arbol.subId}</span>,
    },
    { key: 'especie', header: 'Especie', render: (arbol) => <CeldaEspecie arbol={arbol} /> },
    {
      key: 'parcela',
      header: 'Parcela',
      render: (arbol) =>
        arbol.parcelaId && codigosParcela.get(arbol.parcelaId) ? (
          <span className={styles.codigo}>{codigosParcela.get(arbol.parcelaId)}</span>
        ) : (
          '—'
        ),
    },
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
      render: (arbol) => <span className={styles.numero}>{arbol.posicion ?? '—'}</span>,
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
    {
      key: 'usuario',
      fueraEnMovil: true,
      fueraConPanel: true,
      header: 'Técnico',
      render: (arbol) =>
        (arbol.usuarioRegistro && nombresUsuario.get(arbol.usuarioRegistro)) || '—',
    },
  ];
  return columnas;
}
