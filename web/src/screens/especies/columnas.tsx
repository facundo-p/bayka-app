import { columnaChevron, type TableColumn } from '../../components';
import tabla from '../../components/Table.module.css';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';
import { CeldaArboles, CeldaCientifico, CeldaCodigo, CeldaTexto } from './celdas';

export const COLUMNAS_ESPECIES: Array<TableColumn<EspecieConCatalogoUso>> = [
  { key: 'codigo', header: 'Código', render: (especie) => <CeldaCodigo especie={especie} /> },
  {
    key: 'nombre',
    header: 'Nombre común',
    render: (especie) => <CeldaTexto especie={especie}>{especie.nombre}</CeldaTexto>,
  },
  {
    key: 'nombreCientifico',
    fueraEnMovil: true,
    header: 'Nombre científico',
    render: (especie) => <CeldaCientifico especie={especie} />,
  },
  {
    key: 'plantaciones',
    fueraEnMovil: true,
    header: 'Plantaciones',
    align: 'center',
    render: (especie) => (
      <CeldaTexto especie={especie} clase={tabla.numero}>
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
  columnaChevron(),
];
