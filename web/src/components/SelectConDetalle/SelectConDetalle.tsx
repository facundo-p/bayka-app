import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { varsPosicionAnclada, type PosicionAnclada } from '../../hooks/usePosicionAnclada';
import { FormField } from '../FormField';
import { Disparador } from './Disparador';
import { ListaOpciones, type TextosLista } from './ListaOpciones';
import { useDesplegable, type ValorSelect } from './useDesplegable';
import styles from './SelectConDetalle.module.css';

export type { OpcionConDetalle } from './opcionesConDetalle';

interface SelectConDetalleProps extends ValorSelect, TextosLista {
  placeholder: string;
  hint?: string;
  error?: string;
}

interface PopoverProps {
  refPopover: RefObject<HTMLDivElement | null>;
  posicion: PosicionAnclada;
  children: ReactNode;
}

function Popover({ refPopover, posicion, children }: PopoverProps) {
  return createPortal(
    <div ref={refPopover} className={styles.popover} style={varsPosicionAnclada(posicion)}>
      {children}
    </div>,
    document.body,
  );
}

/**
 * Selector con búsqueda cuyas opciones muestran un texto principal y un detalle
 * más tenue debajo (ej. nombre y email). El `<select>` nativo no permite dar
 * estilo a una parte de la opción.
 */
export function SelectConDetalle(props: SelectConDetalleProps) {
  const { label, placeholder, hint, error } = props;
  const desplegable = useDesplegable(props);
  const { ids, posicion } = desplegable;
  return (
    <FormField id={ids.disparador} labelId={ids.label} label={label} hint={hint} error={error}>
      <Disparador desplegable={desplegable} placeholder={placeholder} invalido={Boolean(error)} />
      {posicion && (
        <Popover refPopover={desplegable.refPopover} posicion={posicion}>
          <ListaOpciones desplegable={desplegable} textos={props} />
        </Popover>
      )}
    </FormField>
  );
}
