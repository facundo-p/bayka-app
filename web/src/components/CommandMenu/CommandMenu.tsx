import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { CabeceraBuscador } from './CabeceraBuscador';
import { DialogoPaleta } from './DialogoPaleta';
import { ListaResultados } from './ListaResultados';
import { useListboxPaleta } from './useListboxPaleta';
import { useSeccionesCommandMenu } from './useSeccionesCommandMenu';

/** Devuelve el foco al elemento que abrió la paleta (el trigger) al cerrar. */
function useDevolverFoco(abierto: boolean) {
  const previo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (abierto) {
      previo.current = document.activeElement as HTMLElement | null;
      return;
    }
    previo.current?.focus?.();
  }, [abierto]);
}

/** Cerrada la paleta el componente sigue montado: cada apertura arranca sin texto y con
 *  foco en el buscador. */
function useBuscadorAlAbrir(abierto: boolean) {
  const [texto, setTexto] = useState('');
  const refInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (abierto) {
      setTexto('');
      refInput.current?.focus();
    }
  }, [abierto]);
  return { texto, setTexto, refInput };
}

export function CommandMenu() {
  const { abierto, cerrar } = useCommandMenu();
  useDevolverFoco(abierto); // antes de enfocar el buscador, para guardar el trigger
  const { texto, setTexto, refInput } = useBuscadorAlAbrir(abierto);
  const contenido = useSeccionesCommandMenu(texto);
  const listbox = useListboxPaleta(contenido.itemsPlanos);
  if (!abierto) return null;
  return createPortal(
    <DialogoPaleta onCerrar={cerrar} onTecla={listbox.alPresionar}>
      <CabeceraBuscador
        refInput={refInput}
        texto={texto}
        onCambiarTexto={setTexto}
        propsBuscador={listbox.propsBuscador()}
      />
      <ListaResultados contenido={contenido} texto={texto} listbox={listbox} />
    </DialogoPaleta>,
    document.body,
  );
}
