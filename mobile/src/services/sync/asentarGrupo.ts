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
  confirmarBaseDeFoto, confirmarBaseDeGps, confirmarBaseDelGrupo, confirmarFotoSubida, confirmarFotosQuitadas, fotoDelArbol,
} from '../../repositories/AsentamientoDeSyncRepository';
import { borradosDePlantacion, limpiarBorrados, type BorradoPendiente } from '../../repositories/BorradosRepository';
import { borrarFotosLocales } from '../PhotoService';
import { CAMPO_EN_CONFLICTO, CAMPOS_DE_GRUPO, type CampoDeGrupo, type CampoEnConflicto } from '../../constants/conflictoDeSync';
import { FOTOS_QUITADAS } from '../../constants/entidadBorrada';
import { fotoSinSubir, isLocalUri, isRemoteUri } from '../../utils/photoUri';
import { asegurarEspecies } from './catalogoDeEspecies';
import {
  camposDeGrupoCambiadosAca, datosDeGrupo, especieCambiadaAca, gpsCambiadoAca, puntoDe,
  type ArbolDeGrupo,
} from './basesDeSync';
import { leerConservados, quitadasAplicadas, type ArbolConservado, type Conservados } from './conservados';

type Tx = typeof db;

/** El grupo al que va un conflicto. */
type DondeVa = Pick<Group, 'id' | 'plantacionId'>;

/** Lo que subió el push del grupo y lo que el servidor conservó; `quitadas`, las fotos quitadas sin propagar. */
interface SubidaDelGrupo {
  fotos: Map<string, string>;
  conservados: Conservados;
  quitadas: Set<string>;
}

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
 * Una foto quitada acá que el servidor conservó porque allá cambió (#810): queda
 * la del servidor y lo de acá pasa a conflicto: sin foto, o la nueva sin subir
 * que se sacó después de quitarla (#816). La quitada deja de estar pendiente: si
 * no, el próximo push la quitaría con la base nueva sin que nadie lo haya decidido.
 */
async function asentarFotoQuitada(tx: Tx, donde: DondeVa, treeId: string, local: string | null, delServidor: string | null): Promise<Asentado> {
  await limpiarBorrados([treeId], FOTOS_QUITADAS, tx);
  if (!(await adoptarFoto(tx, treeId, local, delServidor))) return SIN_ADOPTAR;
  return conflictoSiCambioAca(tx, donde, true,
    { entidadId: treeId, campo: CAMPO_EN_CONFLICTO.foto, mio: local, servidor: delServidor });
}

/**
 * La foto del servidor reemplaza a la local. Una propia sin subir queda en el
 * conflicto; una copia de la anterior del servidor ya no sirve. Una quitada que
 * todavía no llegó al servidor también es un cambio de acá.
 */
async function asentarFoto(tx: Tx, sg: Group, t: ArbolDeGrupo, subida: SubidaDelGrupo, conservado: ArbolConservado): Promise<Asentado> {
  if (conservado.fotoUrl === undefined) return confirmarFoto(tx, t, subida.fotos.get(t.id));
  if (subida.quitadas.has(t.id)) return asentarFotoQuitada(tx, sg, t.id, t.fotoUrl ?? null, conservado.fotoUrl);
  if (!(await adoptarFoto(tx, t.id, t.fotoUrl, conservado.fotoUrl))) return SIN_ADOPTAR;
  const cambioAca = fotoSinSubir(t);
  if (!cambioAca && isLocalUri(t.fotoUrl)) return { ...NADA, archivos: [t.fotoUrl] };
  return conflictoSiCambioAca(tx, sg, cambioAca,
    { entidadId: t.id, campo: CAMPO_EN_CONFLICTO.foto, mio: t.fotoUrl, servidor: conservado.fotoUrl });
}

async function asentarArbol(tx: Tx, sg: Group, t: ArbolDeGrupo, subida: SubidaDelGrupo): Promise<Asentado> {
  const conservado = subida.conservados.arboles.get(t.id) ?? {};
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
  const quitadas = new Set((await borradosDePlantacion(sg.plantacionId, FOTOS_QUITADAS)).map((b) => b.id));
  const subida: SubidaDelGrupo = { fotos: fotosSubidas, conservados, quitadas };
  const asentado = await enTransaccion(async (tx) => {
    let total = await asentarDatosDelGrupo(tx, sg, conservados);
    for (const t of enviados) total = sumar(total, await asentarArbol(tx, sg, t, subida));
    return total;
  });
  // Recién con el commit: con rollback las filas seguirían apuntando a los archivos.
  borrarFotosLocales(asentado.archivos);
  if (asentado.sinAdoptar || await hayConflictosEnGrupo(sg.id)) notifyDataChanged();
  else await markGroupSynced(sg.id);
  return asentado.conflictos;
}

/** Las quitadas que el servidor conservó, con la foto que tiene. */
function quitadasConservadas(pendientes: BorradoPendiente[], respuesta: unknown) {
  const { arboles } = leerConservados(respuesta);
  return pendientes.flatMap((b) => {
    const fotoUrl = arboles.get(b.id)?.fotoUrl;
    return b.grupoId != null && fotoUrl !== undefined
      ? [{ treeId: b.id, donde: { id: b.grupoId, plantacionId: b.plantacionId }, fotoUrl }]
      : [];
  });
}

/**
 * Asienta la respuesta de `quitar_fotos_arboles`: lo quitado deja la base sin foto
 * (#816) y lo conservado se adopta (#810). Devuelve cuántos conflictos nuevos quedaron.
 */
export async function asentarFotosQuitadas(
  pendientes: BorradoPendiente[],
  respuesta: unknown,
  rechazadas: Set<string>,
): Promise<number> {
  const conservadas = quitadasConservadas(pendientes, respuesta);
  const asentado = await enTransaccion(async (tx) => {
    await confirmarFotosQuitadas(tx, quitadasAplicadas(pendientes, respuesta, rechazadas));
    let total = NADA;
    for (const c of conservadas) {
      const local = await fotoDelArbol(tx, c.treeId);
      total = sumar(total, await asentarFotoQuitada(tx, c.donde, c.treeId, local, c.fotoUrl));
    }
    return total;
  });
  borrarFotosLocales(asentado.archivos);
  notifyDataChanged();
  return asentado.conflictos;
}
