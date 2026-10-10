import { columnaChevron, EstadoPlantacionBadge, type TableColumn } from '../../components';
import tabla from '../../components/Table.module.css';
import { cx } from '../../lib/classNames';
import { formatearFechaDia } from '../../lib/fechas';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import { CeldaConteo, CeldaLugar } from './celdas';
import styles from './Plantaciones.module.css';

export const COLUMNAS_PLANTACIONES: Array<TableColumn<PlantacionConStats>> = [
  {
    key: 'lugar',
    header: 'Lugar',
    render: (plantacion) => <CeldaLugar lugar={plantacion.lugar} />,
  },
  {
    key: 'codigo',
    fueraEnMovil: true,
    header: 'Código',
    render: (plantacion) => <span className={tabla.mono}>{plantacion.codigo}</span>,
  },
  {
    key: 'periodo',
    fueraEnMovil: true,
    header: 'Temporada',
    render: (plantacion) => (
      <span className={cx(tabla.mono, styles.temporada)}>{plantacion.periodo}</span>
    ),
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (plantacion) => <EstadoPlantacionBadge estado={plantacion.estado} />,
  },
  {
    key: 'parcelas',
    header: 'Parcelas',
    align: 'center',
    render: (plantacion) => <span className={tabla.numero}>{plantacion.parcelas}</span>,
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'right',
    render: (plantacion) => (
      <CeldaConteo cantidad={plantacion.arboles} className={styles.arboles} />
    ),
  },
  {
    key: 'puntosGps',
    fueraEnMovil: true,
    // Espacio no separable: a 1366 el encabezado se partía en dos renglones.
    header: 'Puntos\u00A0GPS',
    align: 'right',
    render: (plantacion) => <CeldaConteo cantidad={plantacion.puntosGps} />,
  },
  {
    key: 'fotos',
    fueraEnMovil: true,
    header: 'Fotos',
    align: 'right',
    render: (plantacion) => <CeldaConteo cantidad={plantacion.fotos} />,
  },
  {
    key: 'createdAt',
    fueraEnMovil: true,
    header: 'Creada',
    render: (plantacion) => (
      <span className={styles.fecha}>{formatearFechaDia(plantacion.createdAt)}</span>
    ),
  },
  columnaChevron(),
];
