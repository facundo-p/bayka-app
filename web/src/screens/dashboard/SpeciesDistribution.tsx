import { formatearEntero } from '../../lib/formato';
import type { EspecieColoreada } from './coloresEspecies';
import styles from './SpeciesDistribution.module.css';

interface SpeciesDistributionProps {
  especies: EspecieColoreada[];
  totalEspecies: number;
}

/** Máxima cantidad para normalizar el ancho de las barras (la lista viene
 *  ordenada desc, así que es la primera; 1 evita dividir por cero). */
function maximoCantidad(especies: EspecieColoreada[]): number {
  return especies.length > 0 ? especies[0].cantidad : 1;
}

function FilaEspecie({ especie, maximo }: { especie: EspecieColoreada; maximo: number }) {
  const ancho = `${(especie.cantidad / maximo) * 100}%`;
  return (
    <li className={styles.fila}>
      <div className={styles.encabezadoFila}>
        <span className={styles.codigo}>{especie.codigo}</span>
        <span className={styles.nombre}>{especie.nombre}</span>
        <span className={styles.cantidad}>{formatearEntero(especie.cantidad)}</span>
      </div>
      <div className={styles.barra}>
        <div className={styles.relleno} style={{ width: ancho, background: especie.color }} />
      </div>
    </li>
  );
}

/** Panel "Por especie": conteo de especies + barras horizontales por especie. */
export function SpeciesDistribution({ especies, totalEspecies }: SpeciesDistributionProps) {
  const maximo = maximoCantidad(especies);
  // El contenido va en una capa absoluta para que el panel NO crezca con la
  // lista: así el alto de la fila lo fija el mapa y la lista scrollea adentro.
  return (
    <div className={styles.panel}>
      <div className={styles.contenido}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.titulo}>Por especie</h3>
            <p className={styles.subtitulo}>Composición del rodal</p>
          </div>
          <div className={styles.conteo}>
            <span className={styles.conteoNumero}>{totalEspecies}</span>
            <span className={styles.conteoLabel}>especies</span>
          </div>
        </div>
        <ul className={styles.lista}>
          {especies.map((especie) => (
            <FilaEspecie key={especie.codigo} especie={especie} maximo={maximo} />
          ))}
        </ul>
      </div>
    </div>
  );
}
