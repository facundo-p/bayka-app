import type { ReactNode } from 'react';
import { PuntoColor } from '../../components';
import tabla from '../../components/Table.module.css';
import { cx } from '../../lib/classNames';
import { formatearEntero } from '../../lib/formato';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { EspecieConCatalogoUso } from '../../queries/especieQueries';
import { sinUso } from './filtros';
import styles from './Especies.module.css';

/** Clase del texto de una celda: atenuada si la especie no tiene uso. */
function claseSegunUso(especie: EspecieConCatalogoUso, extra?: string): string {
  return cx(extra, sinUso(especie) && styles.filaSinUso);
}

/** Texto plano de la fila, atenuado cuando la especie no tiene uso. */
export function CeldaTexto({
  especie,
  children,
  clase,
}: {
  especie: EspecieConCatalogoUso;
  children: ReactNode;
  clase?: string;
}) {
  return <span className={claseSegunUso(especie, clase)}>{children}</span>;
}

export function CeldaCodigo({ especie }: { especie: EspecieConCatalogoUso }) {
  return (
    <CeldaTexto especie={especie} clase={styles.codigoCelda}>
      <PuntoColor color={colorEspeciePorCodigo(especie.codigo)} />
      <span className={tabla.mono}>{especie.codigo}</span>
    </CeldaTexto>
  );
}

/** Nombre científico en itálica; '—' cuando la especie no lo tiene cargado. */
export function CeldaCientifico({ especie }: { especie: EspecieConCatalogoUso }) {
  if (!especie.nombreCientifico) return <CeldaTexto especie={especie}>—</CeldaTexto>;
  return (
    <CeldaTexto especie={especie} clase={styles.cientifico}>
      {especie.nombreCientifico}
    </CeldaTexto>
  );
}

export function CeldaArboles({ especie }: { especie: EspecieConCatalogoUso }) {
  return (
    <CeldaTexto especie={especie} clase={cx(tabla.mono, tabla.numero)}>
      {formatearEntero(especie.arboles)}
    </CeldaTexto>
  );
}
