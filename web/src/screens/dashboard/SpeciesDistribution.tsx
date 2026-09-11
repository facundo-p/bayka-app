import { BarraProgreso } from '../../components/BarraProgreso';
import { concordar, formatearEntero, PORCENTAJE_COMPLETO, porcentaje } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { EspecieColoreada } from './coloresEspecies';
import styles from './SpeciesDistribution.module.css';

interface SpeciesDistributionProps {
  especies: EspecieColoreada[];
  /** Árboles del alcance visible: denominador del % por especie. */
  total: number;
  totalEspecies: number;
  /** Código de la parcela cuando el panel está filtrado. */
  parcelaFiltro?: string;
}

/** Máxima cantidad para normalizar el ancho de las barras (la lista viene
 *  ordenada desc, así que es la primera; 1 evita dividir por cero). */
function maximoCantidad(especies: EspecieColoreada[]): number {
  return especies.length > 0 ? especies[0].cantidad : 1;
}

interface FilaEspecieProps {
  especie: EspecieColoreada;
  maximo: number;
  total: number;
}

function FilaEspecie({ especie, maximo, total }: FilaEspecieProps) {
  // Relativa a la especie más cargada, no al total: la primera va llena.
  const ancho = (especie.cantidad / maximo) * PORCENTAJE_COMPLETO;
  return (
    <li className={styles.fila}>
      <div className={styles.encabezadoFila}>
        <span className={styles.codigo}>{especie.codigo}</span>
        <span className={styles.nombre}>{especie.nombre}</span>
        <span className={styles.share}>{`${porcentaje(especie.cantidad, total)}%`}</span>
        <span className={styles.cantidad}>{formatearEntero(especie.cantidad)}</span>
      </div>
      <BarraProgreso alto="md" color={especie.color} porcentaje={ancho} />
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

/** Panel "Por especie": conteo de especies + barras horizontales por especie. */
export function SpeciesDistribution(props: SpeciesDistributionProps) {
  const { especies, total, totalEspecies, parcelaFiltro } = props;
  const maximo = maximoCantidad(especies);
  return (
    <div className={styles.panel}>
      <CabeceraEspecies totalEspecies={totalEspecies} parcelaFiltro={parcelaFiltro} />
      <ul className={styles.lista}>
        {especies.map((especie) => (
          <FilaEspecie key={especie.codigo} especie={especie} maximo={maximo} total={total} />
        ))}
      </ul>
    </div>
  );
}
