import { BarraProgreso } from '../../components/BarraProgreso';
import { cx } from '../../lib/classNames';
import { concordar, formatearEntero, PORCENTAJE_COMPLETO, porcentaje } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { EspecieColoreada } from './coloresEspecies';
import styles from './SpeciesDistribution.module.css';

interface SpeciesDistributionProps {
  especies: EspecieColoreada[];
  /** Árboles de la parcela visible: denominador del % por especie. */
  total: number;
  totalEspecies: number;
  /** Código de la parcela cuando el panel está filtrado. */
  parcelaFiltro?: string;
  /** Código de la especie que filtra el dashboard; null si ninguna. */
  especieSeleccionada: string | null;
  onSeleccionar: (codigo: string) => void;
}

/** Máxima cantidad para normalizar el ancho de las barras (la lista viene
 *  ordenada desc, así que es la primera). El piso de 1 evita dividir por cero
 *  cuando la única fila es la especie elegida, en 0. */
function maximoCantidad(especies: EspecieColoreada[]): number {
  return Math.max(especies[0]?.cantidad ?? 0, 1);
}

interface FilaEspecieProps {
  especie: EspecieColoreada;
  maximo: number;
  total: number;
  seleccionada: boolean;
  onSeleccionar: (codigo: string) => void;
}

function FilaEspecie({ especie, maximo, total, seleccionada, onSeleccionar }: FilaEspecieProps) {
  // Relativa a la especie más cargada, no al total: la primera va llena.
  const ancho = (especie.cantidad / maximo) * PORCENTAJE_COMPLETO;
  return (
    <li>
      <button
        type="button"
        className={cx(styles.fila, seleccionada && styles.seleccionada)}
        aria-pressed={seleccionada}
        onClick={() => onSeleccionar(especie.codigo)}
      >
        <span className={styles.encabezadoFila}>
          <span className={styles.codigo}>{especie.codigo}</span>
          <span className={styles.nombre}>{especie.nombre}</span>
          <span className={styles.share}>{`${porcentaje(especie.cantidad, total)}%`}</span>
          <span className={styles.cantidad}>{formatearEntero(especie.cantidad)}</span>
        </span>
        <BarraProgreso alto="md" color={especie.color} porcentaje={ancho} />
      </button>
    </li>
  );
}

function subtituloComposicion(parcelaFiltro?: string): string {
  return parcelaFiltro ? `Composición de la parcela ${parcelaFiltro}` : 'Composición del rodal';
}

type CabeceraEspeciesProps = Pick<SpeciesDistributionProps, 'totalEspecies' | 'parcelaFiltro'>;

function CabeceraEspecies({ totalEspecies, parcelaFiltro }: CabeceraEspeciesProps) {
  return (
    <div className={styles.header}>
      <div>
        <h3 className={styles.titulo}>Por especie</h3>
        <p className={styles.subtitulo}>{subtituloComposicion(parcelaFiltro)}</p>
      </div>
      <div className={styles.conteo}>
        <span className={styles.conteoNumero}>{formatearEntero(totalEspecies)}</span>
        <span className={styles.conteoLabel}>{concordar(totalEspecies, SUSTANTIVO.especie)}</span>
      </div>
    </div>
  );
}

/** Panel "Por especie": conteo de especies + barras horizontales por especie.
 *  Cada fila filtra el dashboard; clickear la elegida la suelta. */
export function SpeciesDistribution(props: SpeciesDistributionProps) {
  const { especies, total, totalEspecies, parcelaFiltro, especieSeleccionada } = props;
  const maximo = maximoCantidad(especies);
  return (
    <div className={styles.panel}>
      <CabeceraEspecies totalEspecies={totalEspecies} parcelaFiltro={parcelaFiltro} />
      <ul className={styles.lista}>
        {especies.map((especie) => (
          <FilaEspecie
            key={especie.codigo}
            especie={especie}
            maximo={maximo}
            total={total}
            seleccionada={especie.codigo === especieSeleccionada}
            onSeleccionar={props.onSeleccionar}
          />
        ))}
      </ul>
    </div>
  );
}
