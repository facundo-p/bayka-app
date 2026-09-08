import { ChevronRight } from 'lucide-react';
import type { TableColumn } from '../../components';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';
import { CeldaArboles, CeldaCientifico, CeldaCodigo, CeldaTexto } from './celdas';
import styles from './Especies.module.css';

const TAMANO_ICONO = 16;

export const COLUMNAS_ESPECIES: Array<TableColumn<EspecieConCatalogoUso>> = [
  { key: 'codigo', header: 'Código', render: (especie) => <CeldaCodigo especie={especie} /> },
  {
    key: 'nombre',
    header: 'Nombre común',
    render: (especie) => <CeldaTexto especie={especie}>{especie.nombre}</CeldaTexto>,
  },
  {
    key: 'nombreCientifico',
    header: 'Nombre científico',
    render: (especie) => <CeldaCientifico especie={especie} />,
  },
  {
    key: 'plantaciones',
    header: 'Plantaciones',
    align: 'center',
    render: (especie) => (
      <CeldaTexto especie={especie} clase={styles.numero}>
        {especie.plantaciones}
      </CeldaTexto>
    ),
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'right',
    render: (especie) => <CeldaArboles especie={especie} />,
  },
  {
    key: 'chevron',
    header: '',
    align: 'right',
    render: () => <ChevronRight className={styles.chevron} size={TAMANO_ICONO} aria-hidden />,
  },
];
