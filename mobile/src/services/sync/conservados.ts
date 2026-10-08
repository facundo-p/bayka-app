/**
 * Lo que `sync_subgroup` conservó del servidor y quedó distinto de lo que mandó el
 * teléfono (`conservados`, 075). Lógica pura: lee la respuesta del RPC.
 */
import { CAMPOS_DE_GRUPO, type CampoDeGrupo } from '../../constants/conflictoDeSync';
import type { PuntoGps } from './basesDeSync';

/** Un dato ausente es uno que el servidor no conservó. */
export interface ArbolConservado {
  especieId?: string | null;
  fotoUrl?: string | null;
  gps?: PuntoGps;
}

export interface Conservados {
  grupo: Partial<Record<CampoDeGrupo, string>>;
  arboles: Map<string, ArbolConservado>;
}

type GpsRemoto = { latitude: number | null; longitude: number | null; gps_accuracy: number | null; gps_captured_at: string | null };
type ArbolRemoto = { id: string; species_id?: string | null; foto_url?: string | null; gps?: GpsRemoto };
type Respuesta = {
  conservados?: { grupo?: Record<string, string>; arboles?: ArbolRemoto[] };
  /** Lo único que devuelve un servidor sin 075. */
  conservadas?: { id: string; species_id: string }[];
};

const puntoRemoto = (gps: GpsRemoto): PuntoGps => ({
  latitude: gps.latitude,
  longitude: gps.longitude,
  gpsAccuracy: gps.gps_accuracy,
  gpsCapturedAt: gps.gps_captured_at,
});

function arbolConservado(remoto: ArbolRemoto): ArbolConservado {
  return {
    ...('species_id' in remoto ? { especieId: remoto.species_id } : {}),
    ...('foto_url' in remoto ? { fotoUrl: remoto.foto_url } : {}),
    ...(remoto.gps ? { gps: puntoRemoto(remoto.gps) } : {}),
  };
}

function grupoConservado(grupo: Record<string, string> | undefined): Partial<Record<CampoDeGrupo, string>> {
  return Object.fromEntries(CAMPOS_DE_GRUPO.flatMap((campo) => (grupo?.[campo] !== undefined ? [[campo, grupo[campo]]] : [])));
}

export function leerConservados(respuesta: unknown): Conservados {
  const r = (respuesta ?? {}) as Respuesta;
  const arboles = r.conservados
    ? (r.conservados.arboles ?? []).map((a): [string, ArbolConservado] => [a.id, arbolConservado(a)])
    : (r.conservadas ?? []).map((a): [string, ArbolConservado] => [a.id, { especieId: a.species_id }]);
  return { grupo: grupoConservado(r.conservados?.grupo), arboles: new Map(arboles) };
}
