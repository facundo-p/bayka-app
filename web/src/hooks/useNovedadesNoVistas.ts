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
import { CLAVE_STORAGE, guardarLocal, leerLocal } from '../lib/almacenamientoLocal';
import { FIRMA_NOVEDADES } from '../lib/novedades';

const suscriptores = new Set<() => void>();

function suscribir(alCambiar: () => void): () => void {
  suscriptores.add(alCambiar);
  return () => {
    suscriptores.delete(alCambiar);
  };
}

// Sin storage se comporta como primera visita.
function hayNoVistas(): boolean {
  return leerLocal(CLAVE_STORAGE.novedadesUltimaVista) !== FIRMA_NOVEDADES;
}

/** Marca la firma actual como vista y avisa a todos los suscriptores. */
export function marcarNovedadesVistas(): void {
  // Aunque no se pueda persistir, el dot se apaga en esta sesión.
  guardarLocal(CLAVE_STORAGE.novedadesUltimaVista, FIRMA_NOVEDADES);
  for (const alCambiar of suscriptores) alCambiar();
}

export function useNovedadesNoVistas(): boolean {
  return useSyncExternalStore(suscribir, hayNoVistas);
}
