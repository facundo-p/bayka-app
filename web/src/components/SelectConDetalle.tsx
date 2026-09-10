import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cx } from '../lib/classNames';
import { varsCss } from '../lib/cssVars';
import { useCerrarAfuera } from '../hooks/useCerrarAfuera';
import { useNavegacionTeclado } from '../hooks/useNavegacionTeclado';
import { usePosicionAnclada, type PosicionAnclada } from '../hooks/usePosicionAnclada';
import { FormField } from './FormField';
import { Input } from './Input';
import { filtrarOpciones, type OpcionConDetalle } from './opcionesConDetalle';
import styles from './SelectConDetalle.module.css';

export type { OpcionConDetalle } from './opcionesConDetalle';

const TAMANO_ICONO = 16;
const TECLAS_ABRIR = new Set(['ArrowDown', 'ArrowUp']);

interface SelectConDetalleProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opciones: OpcionConDetalle[];
  placeholder: string;
  placeholderBusqueda: string;
  /** Cuando no hay ninguna opción. */
  textoVacio: string;
  /** Cuando la búsqueda no coincide con ninguna opción. */
  textoSinCoincidencias: string;
  hint?: string;
  error?: string;
}

type Ids = ReturnType<typeof useIds>;
type Desplegable = ReturnType<typeof useDesplegable>;

function useIds() {
  const base = useId();
  return {
    label: `${base}-label`,
    disparador: `${base}-disparador`,
    valor: `${base}-valor`,
    lista: `${base}-lista`,
    opcion: (indice: number) => `${base}-opcion-${indice}`,
  };
}

/** Apertura, búsqueda y resaltado. Elegir cierra y devuelve el foco al disparador. */
function useDesplegable(
  opciones: OpcionConDetalle[],
  value: string,
  onChange: (valor: string) => void,
) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const refDisparador = useRef<HTMLButtonElement>(null);
  const filtradas = filtrarOpciones(opciones, busqueda);
  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda('');
  }, []);
  const cerrarYEnfocar = () => {
    cerrar();
    refDisparador.current?.focus();
  };
  const elegir = (indice: number) => {
    const opcion = filtradas[indice];
    if (!opcion) return;
    onChange(opcion.valor);
    cerrarYEnfocar();
  };
  const navegacion = useNavegacionTeclado(filtradas.length, elegir);
  const abrir = () => {
    setAbierto(true);
    navegacion.setResaltado(Math.max(0, opciones.findIndex((opcion) => opcion.valor === value)));
  };
  return {
    abierto,
    abrir,
    cerrar,
    cerrarYEnfocar,
    elegir,
    busqueda,
    setBusqueda,
    filtradas,
    refDisparador,
    navegacion,
  };
}

function TextoOpcion({
  opcion,
  clasePrincipal,
  claseSecundario,
}: {
  opcion: OpcionConDetalle;
  clasePrincipal: string;
  claseSecundario: string;
}) {
  // El espacio entre renglones separa nombre y detalle en el nombre accesible.
  return (
    <>
      <span className={clasePrincipal}>{opcion.principal}</span>
      {opcion.secundario && (
        <>
          {' '}
          <span className={claseSecundario}>{opcion.secundario}</span>
        </>
      )}
    </>
  );
}

function Disparador({
  ids,
  desplegable,
  elegida,
  placeholder,
  invalido,
}: {
  ids: Ids;
  desplegable: Desplegable;
  elegida: OpcionConDetalle | undefined;
  placeholder: string;
  invalido: boolean;
}) {
  const { abierto, abrir, cerrar } = desplegable;
  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>) {
    if (abierto || !TECLAS_ABRIR.has(evento.key)) return;
    evento.preventDefault();
    abrir();
  }
  return (
    <button
      ref={desplegable.refDisparador}
      id={ids.disparador}
      type="button"
      className={cx(styles.disparador, invalido && styles.disparadorError)}
      aria-haspopup="listbox"
      aria-expanded={abierto}
      aria-controls={abierto ? ids.lista : undefined}
      aria-labelledby={`${ids.label} ${ids.valor}`}
      aria-invalid={invalido || undefined}
      onClick={abierto ? cerrar : abrir}
      onKeyDown={alTeclear}
    >
      <span id={ids.valor} className={styles.valor}>
        {elegida ? (
          <TextoOpcion
            opcion={elegida}
            clasePrincipal={styles.valorPrincipal}
            claseSecundario={styles.valorSecundario}
          />
        ) : (
          <span className={styles.placeholder}>{placeholder}</span>
        )}
      </span>
    </button>
  );
}

function FilaOpcion({
  id,
  opcion,
  resaltada,
  elegida,
  onElegir,
  onResaltar,
}: {
  id: string;
  opcion: OpcionConDetalle;
  resaltada: boolean;
  elegida: boolean;
  onElegir: () => void;
  onResaltar: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={resaltada}
      data-resaltado={resaltada}
      className={cx(styles.opcion, resaltada && styles.opcionResaltada)}
      // Sin esto el mousedown le saca el foco al buscador antes del click.
      onMouseDown={(evento) => evento.preventDefault()}
      onClick={onElegir}
      onMouseMove={onResaltar}
    >
      <span className={styles.opcionTexto}>
        <TextoOpcion
          opcion={opcion}
          clasePrincipal={cx(styles.opcionPrincipal, elegida && styles.opcionElegida)}
          claseSecundario={styles.opcionSecundario}
        />
      </span>
      {elegida && <Check size={TAMANO_ICONO} aria-hidden className={styles.check} />}
    </div>
  );
}

function aPx(valor: number | null): string {
  return valor === null ? 'auto' : `${valor}px`;
}

function varsPosicion(posicion: PosicionAnclada) {
  return varsCss({
    arriba: aPx(posicion.arriba),
    abajo: aPx(posicion.abajo),
    izquierda: aPx(posicion.izquierda),
    ancho: aPx(posicion.ancho),
    'alto-disponible': aPx(posicion.altoMaximo),
  });
}

function Popover({
  refPopover,
  posicion,
  ids,
  label,
  placeholderBusqueda,
  mensajeVacio,
  desplegable,
  value,
}: {
  refPopover: RefObject<HTMLDivElement | null>;
  posicion: PosicionAnclada;
  ids: Ids;
  label: string;
  placeholderBusqueda: string;
  mensajeVacio: string;
  desplegable: Desplegable;
  value: string;
}) {
  const { filtradas, navegacion } = desplegable;
  const refBusqueda = useRef<HTMLInputElement>(null);
  useEffect(() => refBusqueda.current?.focus(), []);

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      // Cierra solo la lista: sin esto el Escape también cierra el modal.
      evento.stopPropagation();
      desplegable.cerrarYEnfocar();
    } else if (evento.key === 'Tab') {
      // Sin preventDefault: el Tab sigue desde el disparador al próximo control.
      desplegable.cerrarYEnfocar();
    } else {
      navegacion.alPresionar(evento);
    }
  }

  return (
    <div ref={refPopover} className={styles.popover} style={varsPosicion(posicion)}>
      <div className={styles.cabecera}>
        <Input
          ref={refBusqueda}
          label={placeholderBusqueda}
          labelOculto
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded
          aria-autocomplete="list"
          aria-controls={ids.lista}
          aria-activedescendant={
            filtradas.length > 0 ? ids.opcion(navegacion.resaltado) : undefined
          }
          className={styles.busqueda}
          placeholder={placeholderBusqueda}
          value={desplegable.busqueda}
          onChange={(evento) => desplegable.setBusqueda(evento.target.value)}
          onKeyDown={alTeclear}
        />
      </div>
      <div
        id={ids.lista}
        role="listbox"
        aria-label={label}
        ref={navegacion.refLista}
        className={styles.lista}
      >
        {filtradas.map((opcion, indice) => (
          <FilaOpcion
            key={opcion.valor}
            id={ids.opcion(indice)}
            opcion={opcion}
            resaltada={indice === navegacion.resaltado}
            elegida={opcion.valor === value}
            onElegir={() => desplegable.elegir(indice)}
            onResaltar={() => navegacion.setResaltado(indice)}
          />
        ))}
      </div>
      {filtradas.length === 0 && <p className={styles.vacio}>{mensajeVacio}</p>}
    </div>
  );
}

/**
 * Selector con búsqueda cuyas opciones muestran un texto principal y un detalle
 * más tenue debajo (ej. nombre y email). El `<select>` nativo no permite dar
 * estilo a una parte de la opción.
 */
export function SelectConDetalle({
  label,
  value,
  onChange,
  opciones,
  placeholder,
  placeholderBusqueda,
  textoVacio,
  textoSinCoincidencias,
  hint,
  error,
}: SelectConDetalleProps) {
  const ids = useIds();
  const desplegable = useDesplegable(opciones, value, onChange);
  const refCampo = useRef<HTMLDivElement>(null);
  const refPopover = useRef<HTMLDivElement>(null);
  useCerrarAfuera(desplegable.abierto, desplegable.cerrar, refCampo, refPopover);
  const posicion = usePosicionAnclada(desplegable.abierto, desplegable.refDisparador);
  const elegida = opciones.find((opcion) => opcion.valor === value);

  return (
    <FormField id={ids.disparador} labelId={ids.label} label={label} hint={hint} error={error}>
      <div ref={refCampo}>
        <Disparador
          ids={ids}
          desplegable={desplegable}
          elegida={elegida}
          placeholder={placeholder}
          invalido={Boolean(error)}
        />
      </div>
      {desplegable.abierto &&
        posicion &&
        createPortal(
          <Popover
            refPopover={refPopover}
            posicion={posicion}
            ids={ids}
            label={label}
            placeholderBusqueda={placeholderBusqueda}
            mensajeVacio={opciones.length === 0 ? textoVacio : textoSinCoincidencias}
            desplegable={desplegable}
            value={value}
          />,
          document.body,
        )}
    </FormField>
  );
}
