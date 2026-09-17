import { useState, type ChangeEvent } from 'react';
import type { CampoTexto, ValoresUsuario } from './valores';

/** Nombre, email y rol de una persona, como los editan el alta y el panel. */
export function useValoresUsuario(iniciales: ValoresUsuario | (() => ValoresUsuario)) {
  const [valores, setValores] = useState(iniciales);
  function cambiar<C extends keyof ValoresUsuario>(campo: C, valor: ValoresUsuario[C]) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
  }
  const alEscribir = (campo: CampoTexto) => (evento: ChangeEvent<HTMLInputElement>) =>
    cambiar(campo, evento.target.value);
  return { valores, cambiar, alEscribir };
}

export type CamposUsuario = ReturnType<typeof useValoresUsuario>;
