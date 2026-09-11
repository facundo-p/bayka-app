import { ChevronRight } from 'lucide-react';
import { TAMANO_ICONO } from '../theme/iconos';
import type { TableColumn } from './Table';
import styles from './Table.module.css';

/**
 * Última columna de las filas que abren algo: el chevron avisa que la fila es
 * clickeable. Vive fuera de Table.tsx porque un archivo que exporta componentes
 * y funciones pierde el fast refresh.
 */
export function columnaChevron<T>(): TableColumn<T> {
  return {
    key: 'chevron',
    fueraEnMovil: true,
    header: '',
    align: 'right',
    render: () => <ChevronRight className={styles.chevron} size={TAMANO_ICONO.md} aria-hidden />,
  };
}
