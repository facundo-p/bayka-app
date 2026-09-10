/**
 * Marca si hay novedades sin ver: la firma deployada (versión, más la marca de
 * sincronización en staging) no coincide con la última que este navegador marcó
 * como leída. Store de módulo + useSyncExternalStore
 * para que el dot del sidebar se apague solo cuando la pantalla marca vista, sin
 * meter un provider por un booleano.
 *
 * Primera visita (clave ausente) ⇒ hay novedades: sirve de anuncio del feature y
 * no necesita un caso especial.
 */
import { useSyncExternalStore } from 'react';
import { FIRMA_NOVEDADES } from '../lib/novedades';

const CLAVE_ULTIMA_VISTA = 'bayka.novedades.ultima-vista';

const suscriptores = new Set<() => void>();

function leerUltimaVista(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_ULTIMA_VISTA);
  } catch {
    // Modo privado o storage bloqueado: se comporta como primera visita.
    return null;
  }
}

function suscribir(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

function hayNoVistas(): boolean {
  return leerUltimaVista() !== FIRMA_NOVEDADES;
}

/** Marca la firma actual como vista y avisa a todos los suscriptores. */
export function marcarNovedadesVistas(): void {
  try {
    window.localStorage.setItem(CLAVE_ULTIMA_VISTA, FIRMA_NOVEDADES);
  } catch {
    // Si no se puede persistir, igual se apaga el dot en esta sesión.
  }
  for (const alCambiar of suscriptores) alCambiar();
}

export function useNovedadesNoVistas(): boolean {
  return useSyncExternalStore(suscribir, hayNoVistas);
}
