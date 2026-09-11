import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { BotonIcono } from '../../components';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import { TAB_DETALLE } from '../../lib/rutasPlantacion';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './ParcelasStrip.module.css';

/** Cuánto avanza cada flecha: casi una pantalla, dejando una card de contexto. */
const PASO_RIEL = 0.8;

/** El signo del desplazamiento horizontal. */
const DIRECCION = { anterior: -1, siguiente: 1 } as const;

type Direccion = (typeof DIRECCION)[keyof typeof DIRECCION];
type Desplazar = (direccion: Direccion) => void;

const FLECHA: Record<Direccion, { etiqueta: string; Icono: typeof ChevronLeft }> = {
  [DIRECCION.anterior]: { etiqueta: 'Parcelas anteriores', Icono: ChevronLeft },
  [DIRECCION.siguiente]: { etiqueta: 'Parcelas siguientes', Icono: ChevronRight },
};

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

interface MiniCardParcelaProps {
  parcela: ParcelaStrip;
  seleccionada: boolean;
  onSeleccionar: (parcelaId: string) => void;
}

function MiniCardParcela({ parcela, seleccionada, onSeleccionar }: MiniCardParcelaProps) {
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

function useRiel() {
  const rielRef = useRef<HTMLDivElement>(null);
  const desplazar: Desplazar = (direccion) => {
    const riel = rielRef.current;
    if (riel) riel.scrollBy({ left: direccion * riel.clientWidth * PASO_RIEL, behavior: 'smooth' });
  };
  return { rielRef, desplazar };
}

function BotonRiel({ direccion, onDesplazar }: { direccion: Direccion; onDesplazar: Desplazar }) {
  const { etiqueta, Icono } = FLECHA[direccion];
  return (
    <BotonIcono
      variante="contorno"
      tamano="sm"
      etiqueta={etiqueta}
      onClick={() => onDesplazar(direccion)}
    >
      <Icono size={TAMANO_ICONO.md} aria-hidden />
    </BotonIcono>
  );
}

function CabeceraParcelas({ cantidad, onDesplazar }: { cantidad: number; onDesplazar: Desplazar }) {
  return (
    <div className={styles.header}>
      <h3 className={styles.titulo}>Parcelas</h3>
      <span className={styles.recuento}>{`${cantidad} · clic para filtrar`}</span>
      <div className={styles.controles}>
        <Link to={TAB_DETALLE.datos} className={styles.enlace}>
          Ver datos →
        </Link>
        <BotonRiel direccion={DIRECCION.anterior} onDesplazar={onDesplazar} />
        <BotonRiel direccion={DIRECCION.siguiente} onDesplazar={onDesplazar} />
      </div>
    </div>
  );
}

/** Tira de parcelas: filtra el dashboard al clickear una, y enlaza a la tab Datos.
 *  Sus números son los de cada parcela y no siguen al filtro: son el selector. */
export function ParcelasStrip(props: ParcelasStripProps) {
  const { parcelas, parcelaSeleccionada, onSeleccionar } = props;
  const { rielRef, desplazar } = useRiel();
  return (
    <div className={styles.panel}>
      <CabeceraParcelas cantidad={parcelas.length} onDesplazar={desplazar} />
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
