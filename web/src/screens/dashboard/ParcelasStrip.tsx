import { Link } from 'react-router';
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
}

function MiniCardParcela({ parcela }: { parcela: ParcelaStrip }) {
  return (
    <div className={styles.miniCard}>
      <span className={styles.codigo}>{parcela.codigo}</span>
      <span className={styles.arboles}>{formatearEntero(parcela.arboles)}</span>
      <span className={styles.nombre}>{parcela.nombre}</span>
      <span className={styles.grupos}>{`${parcela.grupos} grupos`}</span>
    </div>
  );
}

/** Tira de las principales parcelas (mini-cards) con enlace a la tab Datos. */
export function ParcelasStrip({ parcelas }: ParcelasStripProps) {
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
          <MiniCardParcela key={parcela.id} parcela={parcela} />
        ))}
      </div>
    </div>
  );
}
