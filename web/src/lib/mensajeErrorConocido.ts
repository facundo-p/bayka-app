/** Un error cuyo mensaje escribió el repositorio para el usuario se muestra tal
 *  cual; cualquier otro, con el genérico de la acción. */
export function mensajeErrorConocido(
  error: Error | null,
  conocido: string,
  generico: string,
): string | null {
  if (!error) return null;
  return error.message === conocido ? error.message : generico;
}
