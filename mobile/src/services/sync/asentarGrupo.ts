/**
 * Cierre del push de un grupo (#795) y de las fotos quitadas (#810). Por cada
 * dato: si el servidor aceptó lo que se mandó, eso pasa a ser la base; si conservó
 * el suyo, el teléfono lo adopta y, si también lo había cambiado acá, guarda el
 * propio como conflicto.
 *
 * El grupo queda pendiente mientras tenga conflictos: no está sincronizado hasta
 * que la persona decide. Los demás cambios del grupo ya subieron.
 */
import type { db } from '../../database/client';
import { enTransaccion } from '../../database/transaccion';
import { notifyDataChanged } from '../../database/liveQuery';
import { markGroupSynced, type Group } from '../../repositories/GroupRepository';
import {
  guardarConflicto, hayConflictosEnGrupo, quitarConflictos, type ConflictoNuevo,
} from '../../repositories/ConflictosDeSyncRepository';
import {
  adoptarCampoDeGrupo, adoptarEspecie, adoptarFoto, adoptarGps, confirmarBaseDeEspecie,
  confirmarBaseDeFoto, confirmarBaseDeGps, confirmarBaseDelGrupo, confirmarFotoSubida,
} from '../../repositories/AsentamientoDeSyncRepository';
import { limpiarBorrados, type BorradoPendiente } from '../../repositories/BorradosRepository';
import { borrarFotosLocales } from '../PhotoService';
import { CAMPO_EN_CONFLICTO, CAMPOS_DE_GRUPO, type CampoDeGrupo, type CampoEnConflicto } from '../../constants/conflictoDeSync';
import { FOTOS_QUITADAS } from '../../constants/entidadBorrada';
import { isLocalUri, isRemoteUri } from '../../utils/photoUri';
import { asegurarEspecies } from './catalogoDeEspecies';
import {
  camposDeGrupoCambiadosAca, datosDeGrupo, especieCambiadaAca, fotoCambiadaAca, gpsCambiadoAca, puntoDe,
  type ArbolDeGrupo,
} from './basesDeSync';
import { leerConservados, type ArbolConservado, type Conservados } from './conservados';

type Tx = typeof db;

/** El grupo al que va un conflicto. */
type DondeVa = Pick<Group, 'id' | 'plantacionId'>;

/**
 * Conflictos nuevos, archivos locales que quedaron sin uso, y si algo no se pudo
 * adoptar (cambió durante el push, o falta la especie): el grupo sigue pendiente.
 */
interface Asentado {
  conflictos: number;
  archivos: string[];
  sinAdoptar: boolean;
}

const NADA: Asentado = { conflictos: 0, archivos: [], sinAdoptar: false };
const SIN_ADOPTAR: Asentado = { ...NADA, sinAdoptar: true };

const sumar = (a: Asentado, b: Asentado): Asentado => ({
  conflictos: a.conflictos + b.conflictos,
  archivos: [...a.archivos, ...b.archivos],
  sinAdoptar: a.sinAdoptar || b.sinAdoptar,
});

/** Un dato que el servidor conservó, ya adoptado: conflicto si también cambió acá. */
async function conflictoSiCambioAca(tx: Tx, sg: DondeVa, cambioAca: boolean, conflicto: Omit<ConflictoNuevo, 'grupoId' | 'plantacionId'>): Promise<Asentado> {
  if (!cambioAca) return NADA;
  const archivos = await guardarConflicto(tx, { ...conflicto, grupoId: sg.id, plantacionId: sg.plantacionId });
  return { ...NADA, conflictos: 1, archivos };
}

/** Un dato que el servidor aceptó: si cambió acá, deja atrás un conflicto anterior. */
async function aceptado(tx: Tx, entidadId: string, campo: CampoEnConflicto, cambioAca: boolean): Promise<Asentado> {
  if (!cambioAca) return NADA;
  return { ...NADA, archivos: await quitarConflictos(tx, entidadId, [campo]) };
}

async function asentarEspecie(tx: Tx, sg: Group, t: ArbolDeGrupo, conservado: ArbolConservado): Promise<Asentado> {
  const cambioAca = especieCambiadaAca(t);
  if (conservado.especieId === undefined) {
    if (cambioAca) await confirmarBaseDeEspecie(tx, t.id, t.especieId);
    return aceptado(tx, t.id, CAMPO_EN_CONFLICTO.especie, cambioAca);
  }
  if (!(await adoptarEspecie(tx, t.id, t.especieId, conservado.especieId))) return SIN_ADOPTAR;
  return conflictoSiCambioAca(tx, sg, cambioAca,
    { entidadId: t.id, campo: CAMPO_EN_CONFLICTO.especie, mio: t.especieId, servidor: conservado.especieId });
}

async function asentarGps(tx: Tx, sg: Group, t: ArbolDeGrupo, conservado: ArbolConservado): Promise<Asentado> {
  const cambioAca = gpsCambiadoAca(t);
  const enviado = puntoDe(t);
  if (!conservado.gps) {
    // Sin punto el servidor conserva el suyo, que es la base.
    if (cambioAca && enviado.latitude != null) await confirmarBaseDeGps(tx, t.id, enviado);
    return aceptado(tx, t.id, CAMPO_EN_CONFLICTO.gps, cambioAca);
  }
  if (!(await adoptarGps(tx, t.id, enviado, conservado.gps))) return SIN_ADOPTAR;
  return conflictoSiCambioAca(tx, sg, cambioAca,
    { entidadId: t.id, campo: CAMPO_EN_CONFLICTO.gps, mio: enviado, servidor: conservado.gps });
}

async function confirmarFoto(tx: Tx, t: ArbolDeGrupo, subida: string | undefined): Promise<Asentado> {
  if (subida) {
    await confirmarFotoSubida(tx, t.id, t.fotoUrl!, subida);
    return aceptado(tx, t.id, CAMPO_EN_CONFLICTO.foto, true);
  }
  if (isRemoteUri(t.fotoUrl) && t.fotoUrl !== t.fotoBase) await confirmarBaseDeFoto(tx, t.id, t.fotoUrl);
  return NADA;
}

/**
 * La foto del servidor reemplaza a la local. Una propia sin subir queda en el
 * conflicto; una copia de la anterior del servidor ya no sirve.
 */
async function asentarFoto(tx: Tx, sg: Group, t: ArbolDeGrupo, subida: string | undefined, conservado: ArbolConservado): Promise<Asentado> {
  if (conservado.fotoUrl === undefined) return confirmarFoto(tx, t, subida);
  if (!(await adoptarFoto(tx, t.id, t.fotoUrl, conservado.fotoUrl))) return SIN_ADOPTAR;
  const cambioAca = fotoCambiadaAca(t);
  if (!cambioAca && isLocalUri(t.fotoUrl)) return { ...NADA, archivos: [t.fotoUrl] };
  return conflictoSiCambioAca(tx, sg, cambioAca,
    { entidadId: t.id, campo: CAMPO_EN_CONFLICTO.foto, mio: t.fotoUrl, servidor: conservado.fotoUrl });
}

async function asentarArbol(tx: Tx, sg: Group, t: ArbolDeGrupo, subida: string | undefined, conservados: Conservados): Promise<Asentado> {
  const conservado = conservados.arboles.get(t.id) ?? {};
  return sumar(
    sumar(await asentarEspecie(tx, sg, t, conservado), await asentarGps(tx, sg, t, conservado)),
    await asentarFoto(tx, sg, t, subida, conservado),
  );
}

/** Un campo del grupo. Devuelve el valor del servidor que pasa a ser la base, y lo asentado. */
async function asentarCampoDeGrupo(
  tx: Tx, sg: Group, campo: CampoDeGrupo, delServidor: string | undefined, cambioAca: boolean,
): Promise<{ base: string | undefined; asentado: Asentado }> {
  if (delServidor === undefined) return { base: sg[campo], asentado: await aceptado(tx, sg.id, campo, cambioAca) };
  if (!(await adoptarCampoDeGrupo(tx, sg.id, campo, sg[campo], delServidor))) {
    return { base: sg.baseDelServidor?.[campo], asentado: SIN_ADOPTAR };
  }
  const asentado = await conflictoSiCambioAca(tx, sg, cambioAca, { entidadId: sg.id, campo, mio: sg[campo], servidor: delServidor });
  return { base: delServidor, asentado };
}

async function asentarDatosDelGrupo(tx: Tx, sg: Group, conservados: Conservados): Promise<Asentado> {
  const cambiados = camposDeGrupoCambiadosAca(sg);
  const base = datosDeGrupo(sg);
  let total = NADA;
  for (const campo of CAMPOS_DE_GRUPO) {
    const { base: valor, asentado } = await asentarCampoDeGrupo(tx, sg, campo, conservados.grupo[campo], cambiados.has(campo));
    if (valor !== undefined) base[campo] = valor;
    total = sumar(total, asentado);
  }
  await confirmarBaseDelGrupo(tx, sg.id, base);
  return total;
}

/**
 * Asienta lo que el servidor confirmó del grupo: `enviados` son los árboles tal
 * como viajaron y `fotosSubidas` los paths que subió el push. Devuelve cuántos
 * conflictos nuevos quedaron.
 */
export async function asentarGrupo(
  sg: Group,
  enviados: ArbolDeGrupo[],
  fotosSubidas: Map<string, string>,
  respuesta: unknown,
): Promise<number> {
  const conservados = leerConservados(respuesta);
  // El pull no baja la especie de un grupo pendiente: puede faltar acá.
  await asegurarEspecies([...conservados.arboles.values()].map((a) => a.especieId));
  const asentado = await enTransaccion(async (tx) => {
    let total = await asentarDatosDelGrupo(tx, sg, conservados);
    for (const t of enviados) total = sumar(total, await asentarArbol(tx, sg, t, fotosSubidas.get(t.id), conservados));
    return total;
  });
  // Recién con el commit: con rollback las filas seguirían apuntando a los archivos.
  borrarFotosLocales(asentado.archivos);
  if (asentado.sinAdoptar || await hayConflictosEnGrupo(sg.id)) notifyDataChanged();
  else await markGroupSynced(sg.id);
  return asentado.conflictos;
}

/** Una foto quitada acá que el servidor conservó porque allá cambió: queda la del servidor y lo quitado, en conflicto. */
async function asentarFotoQuitada(tx: Tx, quitada: BorradoPendiente & { grupoId: string }, delServidor: string | null): Promise<Asentado> {
  if (!(await adoptarFoto(tx, quitada.id, null, delServidor))) return SIN_ADOPTAR;
  return conflictoSiCambioAca(tx, { id: quitada.grupoId, plantacionId: quitada.plantacionId }, true,
    { entidadId: quitada.id, campo: CAMPO_EN_CONFLICTO.foto, mio: null, servidor: delServidor });
}

/** Las quitadas que el servidor conservó, con la foto que tiene. */
function quitadasConservadas(pendientes: BorradoPendiente[], respuesta: unknown) {
  const { arboles } = leerConservados(respuesta);
  return pendientes.flatMap((b) => {
    const fotoUrl = arboles.get(b.id)?.fotoUrl;
    return b.grupoId != null && fotoUrl !== undefined ? [{ quitada: { ...b, grupoId: b.grupoId }, fotoUrl }] : [];
  });
}

/**
 * Asienta lo que `quitar_fotos_arboles` conservó (#810). En la misma transacción
 * deja de estar pendiente: si no, el próximo push la quitaría con la base nueva
 * sin que nadie lo haya decidido. Devuelve cuántos conflictos nuevos quedaron.
 */
export async function asentarFotosQuitadas(pendientes: BorradoPendiente[], respuesta: unknown): Promise<number> {
  const conservadas = quitadasConservadas(pendientes, respuesta);
  if (conservadas.length === 0) return 0;
  const asentado = await enTransaccion(async (tx) => {
    let total = NADA;
    for (const { quitada, fotoUrl } of conservadas) total = sumar(total, await asentarFotoQuitada(tx, quitada, fotoUrl));
    await limpiarBorrados(conservadas.map((c) => c.quitada.id), FOTOS_QUITADAS, tx);
    return total;
  });
  borrarFotosLocales(asentado.archivos);
  notifyDataChanged();
  return asentado.conflictos;
}
