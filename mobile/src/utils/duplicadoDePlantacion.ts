/**
 * Aviso de plantación duplicada por lugar + periodo (#633). No hay unique en la
 * base: es solo advertencia, como en la web.
 */
import { esEliminadaEnServidor } from '../constants/estados';

type PlantacionComparable = {
  id: string;
  lugar: string;
  periodo: string;
  eliminadaEnServidorEn: string | null;
};

/** Misma regla que el `ilike` de la web: sin espacios de borde ni distinción de mayúsculas. */
export function normalizarParaComparar(texto: string): string {
  return texto.trim().toLocaleLowerCase();
}

export function mismoLugarYPeriodo(
  a: { lugar: string; periodo: string },
  b: { lugar: string; periodo: string },
): boolean {
  return normalizarParaComparar(a.lugar) === normalizarParaComparar(b.lugar)
    && normalizarParaComparar(a.periodo) === normalizarParaComparar(b.periodo);
}

/** Otra plantación local con el mismo lugar y periodo; `excluirId` es la que se está editando. */
export function buscarDuplicada<T extends PlantacionComparable>(
  plantaciones: readonly T[],
  valores: { lugar: string; periodo: string },
  excluirId?: string,
): T | null {
  if (!valores.lugar.trim() || !valores.periodo.trim()) return null;
  return plantaciones.find((p) =>
    p.id !== excluirId && !esEliminadaEnServidor(p) && mismoLugarYPeriodo(p, valores),
  ) ?? null;
}
