/**
 * Validación pura del formulario de especie (crear/editar).
 * Recibe los valores tal como se tipean (strings) y devuelve un error en
 * español por campo inválido. Sin acceso a datos: testeable aislado.
 */
import type { EspecieInput } from '../repositories/especieRepository';

export type EspecieFormValues = {
  codigo: string;
  nombre: string;
  nombreCientifico: string;
};

export type CampoEspecie = 'codigo' | 'nombre';

export type ErroresEspecie = Partial<Record<CampoEspecie, string>>;

/** Valida el formulario completo; objeto vacío = sin errores. */
export function validarEspecie(valores: EspecieFormValues): ErroresEspecie {
  const errores: ErroresEspecie = {};
  if (valores.codigo.trim() === '') errores.codigo = 'El código es obligatorio';
  if (valores.nombre.trim() === '') errores.nombre = 'El nombre común es obligatorio';
  return errores;
}

export function hayErroresEspecie(errores: ErroresEspecie): boolean {
  return Object.keys(errores).length > 0;
}

/** Nombre científico opcional: vacío → null (así el update lo limpia). */
function textoONull(texto: string): string | null {
  const limpio = texto.trim();
  return limpio === '' ? null : limpio;
}

/** Convierte los valores ya validados al input tipado del repository. */
export function aEspecieInput(valores: EspecieFormValues): EspecieInput {
  return {
    codigo: valores.codigo.trim(),
    nombre: valores.nombre.trim(),
    nombreCientifico: textoONull(valores.nombreCientifico),
  };
}
