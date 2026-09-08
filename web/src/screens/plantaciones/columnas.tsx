import { ChevronRight } from 'lucide-react';
import { EstadoPlantacionBadge, type TableColumn } from '../../components';
import { formatearFechaDia } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import { CeldaLugar, CeldaVisible } from './celdas';
import styles from './Plantaciones.module.css';

const TAMANO_ICONO = 16;

export const COLUMNAS_PLANTACIONES: Array<TableColumn<PlantacionConStats>> = [
  {
    key: 'lugar',
    header: 'Lugar',
    render: (plantacion) => <CeldaLugar lugar={plantacion.lugar} />,
  },
  {
    key: 'periodo',
    header: 'Temporada',
    render: (plantacion) => <span className={styles.temporada}>{plantacion.periodo}</span>,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (plantacion) => <EstadoPlantacionBadge estado={plantacion.estado} />,
  },
  {
    key: 'visibleInApp',
    header: 'Visible',
    render: (plantacion) => <CeldaVisible visible={plantacion.visibleInApp} />,
  },
  {
    key: 'usuarios',
    header: 'Usuarios',
    align: 'center',
    render: (plantacion) => <span className={styles.numero}>{plantacion.usuarios}</span>,
  },
  {
    key: 'parcelas',
    header: 'Parcelas',
    align: 'center',
    render: (plantacion) => <span className={styles.numero}>{plantacion.parcelas}</span>,
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'right',
    render: (plantacion) => (
      <span className={styles.arboles}>{formatearEntero(plantacion.arboles)}</span>
    ),
  },
  {
    key: 'createdAt',
    header: 'Creada',
    render: (plantacion) => (
      <span className={styles.fecha}>{formatearFechaDia(plantacion.createdAt)}</span>
    ),
  },
  {
    key: 'chevron',
    header: '',
    align: 'right',
    render: () => <ChevronRight className={styles.chevron} size={TAMANO_ICONO} aria-hidden />,
  },
];
