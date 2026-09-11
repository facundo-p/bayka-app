import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { BotonIcono } from '../../components';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './ParcelasStrip.module.css';

/** Cuánto avanza cada flecha: casi una pantalla, dejando una card de contexto. */
const PASO_RIEL = 0.8;

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
      <div className={styles.miniCardTop}>
        <span className={styles.codigo}>{parcela.codigo}</span>
        <span className={styles.grupos}>{`${parcela.grupos} grupos`}</span>
      </div>
      <span className={styles.arboles}>{formatearEntero(parcela.arboles)}</span>
      <span className={styles.nombre}>{parcela.nombre}</span>
    </button>
  );
}

/** Tira de parcelas: filtra el dashboard al clickear una, y enlaza a la tab Datos.
 *  Sus números son los de cada parcela y no siguen al filtro: son el selector. */
export function ParcelasStrip({
  parcelas,
  parcelaSeleccionada,
  onSeleccionar,
}: ParcelasStripProps) {
  const rielRef = useRef<HTMLDivElement>(null);

  const desplazar = (direccion: 1 | -1) => {
    const riel = rielRef.current;
    if (riel) riel.scrollBy({ left: direccion * riel.clientWidth * PASO_RIEL, behavior: 'smooth' });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.titulo}>Parcelas</h3>
        <span className={styles.recuento}>{`${parcelas.length} · clic para filtrar`}</span>
        <div className={styles.controles}>
          <Link to="datos" className={styles.enlace}>
            Ver datos →
          </Link>
          <BotonIcono
            variante="contorno"
            tamano="sm"
            etiqueta="Parcelas anteriores"
            onClick={() => desplazar(-1)}
          >
            <ChevronLeft size={TAMANO_ICONO.md} aria-hidden />
          </BotonIcono>
          <BotonIcono
            variante="contorno"
            tamano="sm"
            etiqueta="Parcelas siguientes"
            onClick={() => desplazar(1)}
          >
            <ChevronRight size={TAMANO_ICONO.md} aria-hidden />
          </BotonIcono>
        </div>
      </div>
      <div className={styles.riel} ref={rielRef}>
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
