import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { BP, useMediaQuery } from '../hooks/useMediaQuery';
import { concordar, formatearEntero, type Sustantivo } from '../lib/formato';
import { TAMANO_ICONO } from '../theme/iconos';
import { Button } from './Button';
import { Divisor } from './Divisor';
import { Modal } from './Modal';
import styles from './BarraHerramientas.module.css';

interface BarraHerramientasProps {
  /** Bloque que abre la barra: el buscador, o el selector de sección en Datos.
   *  Un divisor lo separa de los filtros. */
  encabezado?: ReactNode;
  /** Filtros y selectores propios de la pantalla. */
  children?: ReactNode;
  /** Recuento de lo que quedó visible, pegado a la derecha. */
  recuento?: ReactNode;
  /** Nombre del diálogo cuando los filtros se guardan en la hoja del teléfono. */
  tituloFiltros: string;
  /** Cuántos filtros están puestos: el botón de la hoja lo muestra. */
  filtrosActivos: number;
  /** Devuelve los filtros a su valor inicial, desde el pie de la hoja. */
  onLimpiar?: () => void;
}

/**
 * Fila de herramientas compartida por los listados (Plantaciones, Datos,
 * Especies, Usuarios). Antes era el mismo bloque de CSS copiado en los cuatro
 * módulos: un cambio de estilo obligaba a tocar cuatro archivos.
 *
 * En teléfono los filtros se guardan en una hoja y la fila queda en el buscador
 * más un botón: envolviendo ocupaban tres o cuatro renglones. Se aplican al
 * toque —son baratos y el listado está atrás—, así que la hoja no tiene
 * borrador ni "Aplicar", y el recuento viaja a su botón de cierre.
 */
export function BarraHerramientas(props: BarraHerramientasProps) {
  const { encabezado, children, recuento, tituloFiltros, filtrosActivos, onLimpiar } = props;
  const enMovil = useMediaQuery(BP.movil);
  const [hojaAbierta, setHojaAbierta] = useState(false);

  if (enMovil && children) {
    return (
      <div className={styles.barra}>
        {encabezado}
        <Button variant="contorno" onClick={() => setHojaAbierta(true)}>
          <SlidersHorizontal size={TAMANO_ICONO.md} aria-hidden />
          Filtros
          {filtrosActivos > 0 && <span className={styles.cuenta}>{filtrosActivos}</span>}
        </Button>
        <Modal
          open={hojaAbierta}
          title={tituloFiltros}
          posicion="hoja"
          onClose={() => setHojaAbierta(false)}
        >
          <div className={styles.hoja}>{children}</div>
          <div className={styles.pieHoja}>
            {onLimpiar && (
              <Button variant="contorno" disabled={filtrosActivos === 0} onClick={onLimpiar}>
                Limpiar
              </Button>
            )}
            <Button className={styles.verResultados} onClick={() => setHojaAbierta(false)}>
              {recuento ? <span className={styles.verRecuento}>Ver {recuento}</span> : 'Listo'}
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className={styles.barra}>
      {encabezado}
      {encabezado && children && <Divisor />}
      {children}
      {recuento && <span className={styles.recuento}>{recuento}</span>}
    </div>
  );
}

interface RecuentoItemProps {
  cantidad: number;
  sustantivo: Sustantivo;
}

/** Un término del recuento: la cifra en mono, para que alinee entre pantallas,
 *  y el sustantivo concordado. */
export function RecuentoItem({ cantidad, sustantivo }: RecuentoItemProps) {
  return (
    <>
      <strong className={styles.recuentoNumero}>{formatearEntero(cantidad)}</strong>{' '}
      {concordar(cantidad, sustantivo)}
    </>
  );
}
