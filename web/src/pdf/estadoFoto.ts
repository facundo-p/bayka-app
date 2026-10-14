/** Qué muestra la ficha en el lugar de la foto. */
export const ESTADO_FOTO = {
  lista: 'lista',
  sinFoto: 'sin-foto',
  noDisponible: 'no-disponible',
} as const;

export type FotoPdf =
  | { estado: typeof ESTADO_FOTO.lista; src: string }
  | { estado: typeof ESTADO_FOTO.sinFoto }
  | { estado: typeof ESTADO_FOTO.noDisponible };

export function esFotoLista(foto: FotoPdf): foto is Extract<FotoPdf, { src: string }> {
  return foto.estado === ESTADO_FOTO.lista;
}
