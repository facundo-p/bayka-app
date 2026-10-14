/**
 * "Liberar espacio" (#565): borra del celular los archivos de fotos que ya están
 * en el server y deja cada árbol apuntando a su foto en Storage. No es "eliminar
 * de Bayka": no escribe en el server ni en `borrados_pendientes`.
 */
import { supabase } from '../supabase/client';
import { isRemoteUri } from '../utils/photoUri';
import { syncLog } from '../utils/syncLogger';
import {
  contarFotosSinSubir,
  getFotosDescargadas,
  volverFotosARemotas,
  type FotoAVolverRemota,
} from '../repositories/FotosDescargadasRepository';
import { borrarFotosLocales, esFotoDeLaApp, pesoDeFotoLocal } from './PhotoService';

export type ResumenDeEspacio = { fotos: number; bytes: number; sinSubir: number };

export type FotoLiberable = FotoAVolverRemota & { bytes: number };

export type PlanDeLiberacion = {
  fotos: FotoLiberable[];
  bytes: number;
  sinSubir: number;
  /** Descargadas que el server no confirmó (sin acceso, o quitadas en otro celular): se conservan. */
  sinConfirmar: number;
};

/** Ids por consulta: `in(...)` viaja en la URL. */
const IDS_POR_CONSULTA = 100;

async function descargadasDeLaApp() {
  const fotos = await getFotosDescargadas();
  return fotos.filter((f) => esFotoDeLaApp(f.fotoUrl));
}

const sumarBytes = (fotos: readonly { bytes: number }[]) => fotos.reduce((total, f) => total + f.bytes, 0);

/** Lo que muestra Ajustes. Solo lee el celular: funciona sin conexión. */
export async function resumenDeEspacio(): Promise<ResumenDeEspacio> {
  const fotos = await descargadasDeLaApp();
  return {
    fotos: fotos.length,
    bytes: sumarBytes(fotos.map((f) => ({ bytes: pesoDeFotoLocal(f.fotoUrl) }))),
    sinSubir: await contarFotosSinSubir(),
  };
}

/**
 * El celular no guarda el path de Storage de una foto descargada y su formato
 * cambió con el tiempo (#90): se lee del server. Tira si no hay conexión.
 */
async function pathsEnElServer(ids: string[]): Promise<Map<string, string>> {
  const paths = new Map<string, string>();
  for (let i = 0; i < ids.length; i += IDS_POR_CONSULTA) {
    const { data, error } = await supabase
      .from('trees')
      .select('id, foto_url')
      .in('id', ids.slice(i, i + IDS_POR_CONSULTA));
    if (error) throw new Error(error.message);
    for (const fila of data ?? []) {
      if (isRemoteUri(fila.foto_url)) paths.set(fila.id, fila.foto_url);
    }
  }
  return paths;
}

/** Qué se va a liberar, confirmado contra el server. */
export async function prepararLiberacion(): Promise<PlanDeLiberacion> {
  const descargadas = await descargadasDeLaApp();
  const remotas = await pathsEnElServer(descargadas.map((f) => f.id));
  const fotos: FotoLiberable[] = [];
  for (const f of descargadas) {
    const remota = remotas.get(f.id);
    if (remota) fotos.push({ id: f.id, local: f.fotoUrl, remota, bytes: pesoDeFotoLocal(f.fotoUrl) });
  }
  return {
    fotos,
    bytes: sumarBytes(fotos),
    sinSubir: await contarFotosSinSubir(),
    sinConfirmar: descargadas.length - fotos.length,
  };
}

/** Los archivos se borran recién con las filas ya apuntando a Storage. */
export async function liberarEspacio(plan: PlanDeLiberacion): Promise<{ fotos: number; bytes: number }> {
  const liberadas = await volverFotosARemotas(plan.fotos);
  borrarFotosLocales(liberadas.map((f) => f.local));
  syncLog.info(`Liberar espacio: ${liberadas.length} fotos, ${sumarBytes(liberadas)} bytes`);
  return { fotos: liberadas.length, bytes: sumarBytes(liberadas) };
}
