import type { Ref } from 'react';
import { X } from 'lucide-react';
import { useCommandMenu } from '../../hooks/useCommandMenu';
import { Input } from '../Input';
import { TAMANO_ICONO } from '../../theme/iconos';
import type { ListboxPaleta } from './useListboxPaleta';
import styles from './CommandMenu.module.css';

interface CabeceraBuscadorProps {
  refInput: Ref<HTMLInputElement>;
  texto: string;
  onCambiarTexto: (texto: string) => void;
  propsBuscador: ReturnType<ListboxPaleta['propsBuscador']>;
}

/** Quitar el chip amplía la búsqueda a toda la organización. */
function ChipScope() {
  const { scope, limpiarScope } = useCommandMenu();
  if (!scope) return null;
  return (
    <button type="button" className={styles.chipScope} onClick={limpiarScope}>
      en {scope.etiqueta || 'plantación'}
      <X size={TAMANO_ICONO.xs} aria-hidden />
    </button>
  );
}

export function CabeceraBuscador(props: CabeceraBuscadorProps) {
  const { refInput, texto, onCambiarTexto, propsBuscador } = props;
  return (
    <div className={styles.cabecera}>
      <ChipScope />
      <Input
        ref={refInput}
        label="Buscar"
        labelOculto
        placeholder="Buscar plantaciones, árboles, especies…"
        value={texto}
        onChange={(evento) => onCambiarTexto(evento.target.value)}
        autoComplete="off"
        {...propsBuscador}
      />
    </div>
  );
}
