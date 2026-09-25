/**
 * Espera `enCurso` como mucho `ms`. Si vence antes de que haya respuesta, llama a
 * `alVencer` y devuelve `siVence`: la tarea sigue sola. Si la respuesta ya llegó
 * (`respondio`), espera a que termine de registrarla aunque pase el tope, para que no
 * quede a medias entre la política de la pantalla y la del sync.
 */
export async function esperarHasta<T>(
  enCurso: Promise<T>,
  ms: number,
  opciones: { respondio: () => boolean; alVencer: () => void; siVence: T },
): Promise<T> {
  let tope: ReturnType<typeof setTimeout> | undefined;
  const vencido = new Promise<typeof VENCIDO>((resolve) => { tope = setTimeout(() => resolve(VENCIDO), ms); });
  const primero = await Promise.race([enCurso, vencido]).finally(() => clearTimeout(tope));
  if (primero !== VENCIDO) return primero as T;
  if (opciones.respondio()) return enCurso;
  opciones.alVencer();
  enCurso.catch(() => {});
  return opciones.siVence;
}

const VENCIDO = Symbol('vencido');
