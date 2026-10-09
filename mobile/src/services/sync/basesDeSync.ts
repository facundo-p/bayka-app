/**
 * Las bases que manda el push (#795): lo que el servidor tenía la última vez que
 * el teléfono vio el dato. Con ellas `sync_subgroup` (075) distingue un cambio
 * del teléfono de una copia vieja, y no pisa lo que cambió en el servidor.
 * Lógica pura, sin acceso a datos.
 */
import type { trees } from '../../database/schema';
import type { Group } from '../../repositories/GroupRepository';
import {
  CAMPOS_DE_GRUPO, type CampoDeGrupo, type DatosDeGrupo, type PuntoGps,
} from '../../constants/conflictoDeSync';
import { isLocalUri } from '../../utils/photoUri';

/** El árbol tal como se leyó antes del push. */
export type ArbolDeGrupo = typeof trees.$inferSelect;

export const puntoDe = (t: ArbolDeGrupo): PuntoGps => ({
  latitude: t.latitude ?? null,
  longitude: t.longitude ?? null,
  gpsAccuracy: t.gpsAccuracy ?? null,
  gpsCapturedAt: t.gpsCapturedAt ?? null,
});

const puntoBaseDe = (t: ArbolDeGrupo) => ({
  latitude: t.latitudeBase ?? null,
  longitude: t.longitudeBase ?? null,
  gpsCapturedAt: t.gpsCapturedAtBase ?? null,
});

export const mismoPunto = (a: Omit<PuntoGps, 'gpsAccuracy'>, b: Omit<PuntoGps, 'gpsAccuracy'>): boolean =>
  a.latitude === b.latitude && a.longitude === b.longitude && a.gpsCapturedAt === b.gpsCapturedAt;

export const especieCambiadaAca = (t: ArbolDeGrupo): boolean => (t.especieId ?? null) !== (t.especieBaseId ?? null);

export const gpsCambiadoAca = (t: ArbolDeGrupo): boolean => !mismoPunto(puntoDe(t), puntoBaseDe(t));

/**
 * Una foto bajada antes de que el teléfono guardara bases: está en el servidor,
 * pero no se sabe con qué path. Sin base, el servidor no la compara.
 */
const fotoSinBaseConocida = (t: ArbolDeGrupo): boolean =>
  isLocalUri(t.fotoUrl) && t.fotoSynced && t.fotoBase == null;

/** Las claves de base de un árbol en el payload de `sync_subgroup`. */
export function basesDelArbol(t: ArbolDeGrupo) {
  const gps = puntoBaseDe(t);
  return {
    gps_base: gps.latitude == null && gps.longitude == null && gps.gpsCapturedAt == null
      ? null
      : { latitude: gps.latitude, longitude: gps.longitude, gps_captured_at: gps.gpsCapturedAt },
    ...(fotoSinBaseConocida(t) ? {} : { foto_base: t.fotoBase ?? null }),
  };
}

/**
 * `p_bases` de `quitar_fotos_arboles` (076, #810): por árbol, la foto que el
 * teléfono vio en el servidor. Sin `fotoBase` no se sabe si no vio ninguna o si
 * la bajó antes de guardar bases: va sin base y el servidor la quita como antes.
 */
export function basesDeFotosQuitadas(arboles: Pick<ArbolDeGrupo, 'id' | 'fotoBase'>[]): Record<string, string> {
  return Object.fromEntries(arboles.flatMap((t) => (t.fotoBase == null ? [] : [[t.id, t.fotoBase]])));
}

export const datosDeGrupo = (g: DatosDeGrupo): DatosDeGrupo =>
  Object.fromEntries(CAMPOS_DE_GRUPO.map((campo) => [campo, g[campo]])) as DatosDeGrupo;

/** Los campos del grupo que cambiaron acá desde la base. Sin base, ninguno: no se sabe. */
export function camposDeGrupoCambiadosAca(g: Group): Set<CampoDeGrupo> {
  const base = g.baseDelServidor;
  if (!base) return new Set();
  return new Set(CAMPOS_DE_GRUPO.filter((campo) => g[campo] !== base[campo]));
}
