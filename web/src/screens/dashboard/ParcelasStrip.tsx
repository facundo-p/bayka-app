import { Link } from 'react-router';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import styles from './ParcelasStrip.module.css';

interface ParcelaStrip {
  id: string;
  codigo: string;
  nombre: string;
  arboles: number;
  grupos: number;
}

interface ParcelasStripProps {
  parcelas: ParcelaStrip[];
  parcelaSeleccionada: string | null;
  onSeleccionar: (parcelaId: string) => void;
}

function MiniCardParcela({
  parcela,
  seleccionada,
  onSeleccionar,
}: {
  parcela: ParcelaStrip;
  seleccionada: boolean;
  onSeleccionar: (parcelaId: string) => void;
}) {
  return (
    <button
      type="button"
      className={cx(styles.miniCard, seleccionada && styles.seleccionada)}
      aria-pressed={seleccionada}
      onClick={() => onSeleccionar(parcela.id)}
    >
      <span className={styles.codigo}>{parcela.codigo}</span>
      <span className={styles.arboles}>{formatearEntero(parcela.arboles)}</span>
      <span className={styles.nombre}>{parcela.nombre}</span>
      <span className={styles.grupos}>{`${parcela.grupos} grupos`}</span>
    </button>
  );
}

/** Tira de parcelas: filtra el mapa al clickear una, y enlaza a la tab Datos. */
export function ParcelasStrip({
  parcelas,
  parcelaSeleccionada,
  onSeleccionar,
}: ParcelasStripProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.titulo}>Parcelas</h3>
        <Link to="datos" className={styles.enlace}>
          Ver datos →
        </Link>
      </div>
      <div className={styles.grilla}>
        {parcelas.map((parcela) => (
          <MiniCardParcela
            key={parcela.id}
            parcela={parcela}
            seleccionada={parcela.id === parcelaSeleccionada}
            onSeleccionar={onSeleccionar}
          />
        ))}
      </div>
    </div>
  );
}
