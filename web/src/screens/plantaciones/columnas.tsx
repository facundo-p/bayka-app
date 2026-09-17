import { columnaChevron, EstadoPlantacionBadge, type TableColumn } from '../../components';
import tabla from '../../components/Table.module.css';
import { cx } from '../../lib/classNames';
import { formatearFechaDia } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import { CeldaLugar, CeldaVisible } from './celdas';
import styles from './Plantaciones.module.css';

export const COLUMNAS_PLANTACIONES: Array<TableColumn<PlantacionConStats>> = [
  {
    key: 'lugar',
    header: 'Lugar',
    render: (plantacion) => <CeldaLugar lugar={plantacion.lugar} />,
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
    key: 'visibleInApp',
    fueraEnMovil: true,
    header: 'Visible',
    render: (plantacion) => <CeldaVisible visible={plantacion.visibleInApp} />,
  },
  {
    key: 'usuarios',
    fueraEnMovil: true,
    header: 'Usuarios',
    align: 'center',
    render: (plantacion) => <span className={tabla.numero}>{plantacion.usuarios}</span>,
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
      <span className={cx(tabla.mono, tabla.numero, styles.arboles)}>
        {formatearEntero(plantacion.arboles)}
      </span>
    ),
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
