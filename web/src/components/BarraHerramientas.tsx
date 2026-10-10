import { useState, type ReactNode } from 'react';
import { BP, useMediaQuery } from '../hooks/useMediaQuery';
import { concordar, formatearEntero, type Sustantivo } from '../lib/formato';
import { Button } from './Button';
import { Divisor } from './Divisor';
import { Modal } from './Modal';
import { BotonFiltros, PanelFiltros } from './PanelFiltros';
import styles from './BarraHerramientas.module.css';

interface BarraHerramientasProps {
  /** Bloque que abre la barra: el buscador, o el selector de sección en Datos. */
  encabezado?: ReactNode;
  /**
   * Buscador, cuando el encabezado es otra cosa (en Datos, el selector de
   * sección). Queda a la vista en todos los anchos, como el buscador que abre
   * la barra en los demás listados.
   */
  busqueda?: ReactNode;
  /** Filtros propios de la pantalla: van al panel, o a la hoja en teléfono. */
  children?: ReactNode;
  /** Selector de orden. No filtra: queda a la vista, salvo en teléfono, que va al pie de la hoja. */
  orden?: ReactNode;
  /** Recuento de lo que quedó visible, pegado a la derecha. */
  recuento?: ReactNode;
  /** Botones que actúan sobre el listado, al final de la fila. */
  acciones?: ReactNode;
  /** Nombre accesible del panel y de la hoja de filtros. */
  tituloFiltros: string;
  /** Cuántos filtros están puestos: el botón de filtros lo muestra. */
  filtrosActivos: number;
  /** Devuelve los filtros a su valor inicial, desde el pie del panel o de la hoja. */
  onLimpiar?: () => void;
}

/**
 * Fila de herramientas compartida por los listados (Plantaciones, Datos,
 * Especies, Usuarios). Antes era el mismo bloque de CSS copiado en los cuatro
 * módulos: un cambio de estilo obligaba a tocar cuatro archivos.
 *
 * Los filtros viven detrás de un botón con la cuenta de los puestos (#844): en
 * línea, cada filtro nuevo sumaba un renglón. Se aplican al toque —son baratos
 * y el listado está atrás—, así que ni el panel ni la hoja tienen "Aplicar".
 */
export function BarraHerramientas(props: BarraHerramientasProps) {
  const enMovil = useMediaQuery(BP.movil);
  const { children, orden } = props;
  if (enMovil && (children || orden)) return <BarraMovil {...props} />;
  return <BarraEscritorio {...props} enMovil={enMovil} />;
}

interface CabezaProps {
  encabezado?: ReactNode;
  busqueda?: ReactNode;
  enMovil: boolean;
}

/**
 * Encabezado y buscador. En teléfono el encabezado va en su propio renglón: el
 * buscador crece desde cero y, al lado del selector de sección de Datos, se
 * quedaba en la lupa sola.
 */
function Cabeza({ encabezado, busqueda, enMovil }: CabezaProps) {
  const ambos = Boolean(encabezado && busqueda);
  return (
    <>
      {ambos && enMovil ? <div className={styles.renglonPropio}>{encabezado}</div> : encabezado}
      {ambos && !enMovil && <Divisor />}
      {busqueda}
    </>
  );
}

/** Buscador, botón de filtros con su panel, orden, recuento y acciones, en ese orden. */
function BarraEscritorio(props: BarraHerramientasProps & { enMovil: boolean }) {
  const { encabezado, busqueda, children, orden, recuento, acciones } = props;
  return (
    <div className={styles.barra}>
      <Cabeza encabezado={encabezado} busqueda={busqueda} enMovil={props.enMovil} />
      {children && (
        <PanelFiltros
          titulo={props.tituloFiltros}
          activos={props.filtrosActivos}
          onLimpiar={props.onLimpiar}
          recuento={recuento}
        >
          {children}
        </PanelFiltros>
      )}
      {orden}
      {recuento && <span className={styles.recuento}>{recuento}</span>}
      {acciones && <div className={styles.acciones}>{acciones}</div>}
    </div>
  );
}

/**
 * En teléfono la fila queda en el encabezado, el buscador y el botón, y los
 * filtros y el orden van a una hoja: envolviendo ocupaban tres o cuatro
 * renglones. El recuento viaja al botón que la cierra.
 */
function BarraMovil(props: BarraHerramientasProps) {
  const { encabezado, busqueda, acciones, tituloFiltros, filtrosActivos } = props;
  const [abierta, setAbierta] = useState(false);
  return (
    <div className={styles.barra}>
      <Cabeza encabezado={encabezado} busqueda={busqueda} enMovil />
      <BotonFiltros activos={filtrosActivos} onClick={() => setAbierta(true)} />
      {acciones && <div className={styles.acciones}>{acciones}</div>}
      <Modal open={abierta} title={tituloFiltros} posicion="hoja" onClose={() => setAbierta(false)}>
        <HojaFiltros {...props} onCerrar={() => setAbierta(false)} />
      </Modal>
    </div>
  );
}

function HojaFiltros(props: BarraHerramientasProps & { onCerrar: () => void }) {
  const { children, orden, recuento, filtrosActivos, onLimpiar } = props;
  return (
    <>
      <div className={styles.hoja}>
        {children}
        {orden}
      </div>
      <div className={styles.pieHoja}>
        {onLimpiar && (
          <Button variant="contorno" disabled={filtrosActivos === 0} onClick={onLimpiar}>
            Limpiar
          </Button>
        )}
        <Button className={styles.verResultados} onClick={props.onCerrar}>
          {recuento ? <span className={styles.verRecuento}>Ver {recuento}</span> : 'Listo'}
        </Button>
      </div>
    </>
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
