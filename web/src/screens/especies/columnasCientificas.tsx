import { columnaChevron, type TableColumn } from '../../components';
import tabla from '../../components/Table.module.css';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';
import { sinEspecies } from './filtrosCientificas';
import styles from './Especies.module.css';

/** Atenuada si no agrupa ninguna especie, como una especie sin uso. */
function clase(cientifica: EspecieCientificaConEspecies, extra?: string): string {
  return cx(extra, sinEspecies(cientifica) && styles.filaSinUso);
}

function nombresComunes(cientifica: EspecieCientificaConEspecies): string {
  if (sinEspecies(cientifica)) return '—';
  return cientifica.especies.map((especie) => especie.nombre).join(', ');
}

export const COLUMNAS_CIENTIFICAS: Array<TableColumn<EspecieCientificaConEspecies>> = [
  {
    key: 'nombre',
    header: 'Nombre científico',
    render: (cientifica) => (
      <span className={clase(cientifica, styles.nombreCientifico)}>{cientifica.nombre}</span>
    ),
  },
  {
    key: 'nombresComunes',
    fueraEnMovil: true,
    fueraConPanel: true,
    header: 'Nombres comunes',
    render: (cientifica) => <span className={clase(cientifica)}>{nombresComunes(cientifica)}</span>,
  },
  {
    key: 'especies',
    header: 'Especies',
    align: 'right',
    render: (cientifica) => (
      <span className={clase(cientifica, cx(tabla.mono, tabla.numero))}>
        {formatearEntero(cientifica.especies.length)}
      </span>
    ),
  },
  columnaChevron(),
];
