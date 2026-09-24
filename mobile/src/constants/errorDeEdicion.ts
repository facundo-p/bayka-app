/** Rechazos de un repositorio que la UI ya evita pero el repo igual tiene que hacer cumplir. */
export const ERROR_DE_EDICION = {
  plantacionNoEditable: 'plantacion_no_editable',
} as const;

export type ErrorDeEdicion = (typeof ERROR_DE_EDICION)[keyof typeof ERROR_DE_EDICION];

export const esPlantacionNoEditable = (error: string) => error === ERROR_DE_EDICION.plantacionNoEditable;

/** Un pull pudo finalizar o archivar la plantación con el formulario abierto. */
export const MENSAJE_PLANTACION_NO_EDITABLE = 'La plantación ya no admite cambios.';

/** Nombre o código ya usados por otra parcela o grupo del mismo ámbito. */
export const ERROR_DE_DUPLICADO = {
  nombre: 'nombre_duplicate',
  codigo: 'codigo_duplicate',
  ambos: 'both_duplicate',
} as const;

export type ErrorDeDuplicado = (typeof ERROR_DE_DUPLICADO)[keyof typeof ERROR_DE_DUPLICADO];

const chocaElNombre = (error: string) =>
  error === ERROR_DE_DUPLICADO.nombre || error === ERROR_DE_DUPLICADO.ambos;

const chocaElCodigo = (error: string) =>
  error === ERROR_DE_DUPLICADO.codigo || error === ERROR_DE_DUPLICADO.ambos;

type MensajesPorCampo = { nombre: string | null; codigo: string | null };

/** El mensaje de cada campo que choca (`ambos` marca los dos); null si el error no es de duplicado. */
export function camposDuplicados(
  error: string,
  mensajes: { nombre: string; codigo: string },
): MensajesPorCampo | null {
  if (!chocaElNombre(error) && !chocaElCodigo(error)) return null;
  return {
    nombre: chocaElNombre(error) ? mensajes.nombre : null,
    codigo: chocaElCodigo(error) ? mensajes.codigo : null,
  };
}
