/**
 * Textos de un conflicto de sincronización en "Resolver cambios" (#804): el valor del
 * teléfono contra el del servidor, con su detalle, y por qué no se puede conservar
 * el propio. Lógica pura.
 */
import { distanciaMetros } from '../../../shared/distancia';
import {
  CAMPO_EN_CONFLICTO, ERROR_DE_CONFLICTO, esCampoDeGrupo, type CampoEnConflicto, type PuntoGps,
} from '../constants/conflictoDeSync';
import { ERROR_DE_DUPLICADO, ERROR_DE_EDICION } from '../constants/errorDeEdicion';
import { ESTADO_GRUPO } from '../constants/estados';
import { GROUP_TIPO_LABELS, esGroupTipo } from '../constants/groupTipo';
import type { ConflictoDeSyncEnContexto, EspecieEnConflicto } from '../queries/conflictosDeSyncQueries';
import { entidadPresente, type MotivoSinConservar } from './conflictosDeSync';
import { textoDeMomento } from './textoDeConflicto';
import type { OpcionDeConflicto, VistaDeConflicto } from './vistaDeConflicto';

export type ConflictoAMostrar = ConflictoDeSyncEnContexto & { motivo: MotivoSinConservar | null };

export const ETIQUETA_DE_CAMPO_DE_SYNC: Record<CampoEnConflicto, string> = {
  [CAMPO_EN_CONFLICTO.especie]: 'Especie',
  [CAMPO_EN_CONFLICTO.gps]: 'Ubicación GPS',
  [CAMPO_EN_CONFLICTO.foto]: 'Foto',
  [CAMPO_EN_CONFLICTO.nombre]: 'Nombre del grupo',
  [CAMPO_EN_CONFLICTO.codigo]: 'Código del grupo',
  [CAMPO_EN_CONFLICTO.tipo]: 'Tipo de grupo',
  [CAMPO_EN_CONFLICTO.estado]: 'Estado del grupo',
};

const ORIGEN_MIO = 'En este teléfono';
const ORIGEN_SERVIDOR = 'En el servidor';
const NO_DISPONIBLE = 'no disponible';
const SIN_DATO = 'Sin dato';
const NOTA_FOTO = 'Si queda la del servidor, la foto sacada en este teléfono se borra.';
const DECIMALES_GPS = 5;

const entidadDe = (campo: CampoEnConflicto) => (esCampoDeGrupo(campo) ? 'grupo' : 'árbol');
const METROS_EN_KM = 1000;

const ETIQUETA_DE_ESTADO: Record<string, string> = {
  [ESTADO_GRUPO.activa]: 'Activo',
  [ESTADO_GRUPO.finalizada]: 'Finalizado',
  [ESTADO_GRUPO.sincronizada]: 'Finalizado',
};

function textoDeEspecie(especie: EspecieEnConflicto | null, especieId: unknown): string {
  if (especie) return `${especie.nombre} (${especie.codigo})`;
  return especieId == null ? 'N/N' : 'Especie que ya no está en el teléfono';
}

type ConCoordenadas = PuntoGps & { latitude: number; longitude: number };

const tieneCoordenadas = (punto: unknown): punto is ConCoordenadas =>
  (punto as PuntoGps | null)?.latitude != null && (punto as PuntoGps).longitude != null;

function textoDePunto(punto: unknown): string {
  if (!tieneCoordenadas(punto)) return 'Sin punto GPS';
  return `${punto.latitude.toFixed(DECIMALES_GPS)}, ${punto.longitude.toFixed(DECIMALES_GPS)}`;
}

function detalleDePunto(punto: unknown): string | null {
  if (!tieneCoordenadas(punto)) return null;
  const precision = punto.gpsAccuracy != null ? `±${Math.round(punto.gpsAccuracy)} m` : null;
  const partes = [precision, textoDeMomento(punto.gpsCapturedAt)].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

export function textoDeDistancia(metros: number): string {
  if (metros < METROS_EN_KM) return `${Math.round(metros)} m`;
  return `${(metros / METROS_EN_KM).toFixed(1).replace('.', ',')} km`;
}

function textoDeDatoDeGrupo(campo: CampoEnConflicto, valor: unknown): string {
  if (typeof valor !== 'string' || valor === '') return SIN_DATO;
  if (campo === CAMPO_EN_CONFLICTO.tipo) return esGroupTipo(valor) ? GROUP_TIPO_LABELS[valor] : valor;
  if (campo === CAMPO_EN_CONFLICTO.estado) return ETIQUETA_DE_ESTADO[valor] ?? valor;
  return valor;
}

const puntoDelArbol = (arbol: ConflictoDeSyncEnContexto['arbol']): PuntoGps | null => arbol && {
  latitude: arbol.latitude, longitude: arbol.longitude, gpsAccuracy: arbol.gpsAccuracy, gpsCapturedAt: arbol.gpsCapturedAt,
};

/** Lo que tiene hoy el árbol o el grupo, que es lo del servidor. */
function valorDelServidor({ conflicto, arbol, grupo }: ConflictoDeSyncEnContexto): unknown {
  const { campo } = conflicto;
  if (esCampoDeGrupo(campo)) return grupo?.[campo];
  if (campo === CAMPO_EN_CONFLICTO.gps) return puntoDelArbol(arbol);
  if (campo === CAMPO_EN_CONFLICTO.foto) return arbol?.fotoUrl ?? null;
  return arbol?.especieId ?? null;
}

const fotoDe = (treeId: string, uri: unknown, enLinea: boolean) =>
  (typeof uri === 'string' && uri !== '' ? { treeId, uri, enLinea } : null);

const LADO = { mio: 'mio', servidor: 'servidor' } as const;
type Lado = (typeof LADO)[keyof typeof LADO];

/** El valor y el detalle de un lado. */
function opcion(c: ConflictoDeSyncEnContexto, lado: Lado, enLinea: boolean): Omit<OpcionDeConflicto, 'origen'> {
  const { campo, entidadId } = c.conflicto;
  const esMio = lado === LADO.mio;
  const valor = esMio ? c.conflicto.mio : valorDelServidor(c);
  switch (campo) {
    case CAMPO_EN_CONFLICTO.especie: return { valor: textoDeEspecie(esMio ? c.especies.mia : c.especies.servidor, valor) };
    case CAMPO_EN_CONFLICTO.gps: return { valor: textoDePunto(valor), detalle: detalleDePunto(valor) };
    case CAMPO_EN_CONFLICTO.foto: {
      const foto = fotoDe(entidadId, valor, enLinea);
      return { valor: foto ? '' : 'Sin foto', foto };
    }
    default: return { valor: textoDeDatoDeGrupo(campo, valor) };
  }
}

/** Si el árbol o el grupo ya no está, no hay valor del servidor que mostrar. */
function opcionDelServidor(c: ConflictoDeSyncEnContexto, enLinea: boolean): OpcionDeConflicto {
  if (!entidadPresente(c)) return { origen: ORIGEN_SERVIDOR, valor: `El ${entidadDe(c.conflicto.campo)} ya no existe` };
  return { origen: ORIGEN_SERVIDOR, ...opcion(c, LADO.servidor, enLinea) };
}

function nota(c: ConflictoDeSyncEnContexto): string | null {
  if (c.conflicto.campo === CAMPO_EN_CONFLICTO.foto) return NOTA_FOTO;
  const servidor = valorDelServidor(c);
  if (c.conflicto.campo !== CAMPO_EN_CONFLICTO.gps || !tieneCoordenadas(c.conflicto.mio) || !tieneCoordenadas(servidor)) {
    return null;
  }
  const a = { lat: c.conflicto.mio.latitude, lng: c.conflicto.mio.longitude };
  const metros = distanciaMetros(a, { lat: servidor.latitude, lng: servidor.longitude });
  return `Los dos puntos están a ${textoDeDistancia(metros)}.`;
}

function motivoDeDuplicado(campo: CampoEnConflicto, mio: unknown): string {
  if (campo === CAMPO_EN_CONFLICTO.codigo) {
    return `Ya hay otro grupo con el código «${String(mio).toUpperCase()}» en esta parcela. `
      + 'Cambiale el código al otro grupo o quedate con el del servidor.';
  }
  return `Ya hay otro grupo «${String(mio)}» en esta parcela. Cambiale el nombre al otro grupo o quedate con el del servidor.`;
}

function motivoSinValor(campo: CampoEnConflicto): string {
  if (campo === CAMPO_EN_CONFLICTO.especie) return 'Tu especie ya no está en la plantación.';
  if (campo === CAMPO_EN_CONFLICTO.gps) return 'Tu punto GPS quedó incompleto y no se puede volver a aplicar.';
  return 'Tu valor no se puede volver a aplicar.';
}


export function textoDeMotivo(motivo: MotivoSinConservar, { campo, mio }: { campo: CampoEnConflicto; mio: unknown }): string {
  switch (motivo) {
    case ERROR_DE_EDICION.plantacionNoEditable: return 'La plantación está finalizada. Para conservar la tuya, pedí que la reabran.';
    case ERROR_DE_EDICION.sinPermiso: return 'No tenés permiso para cambiar los árboles de este grupo.';
    case ERROR_DE_CONFLICTO.inexistente:
      return `Este ${entidadDe(campo)} se borró en otro celular o en la web. Tu cambio no se puede aplicar.`;
    case ERROR_DE_CONFLICTO.sinValor: return motivoSinValor(campo);
    case ERROR_DE_DUPLICADO.nombre:
    case ERROR_DE_DUPLICADO.codigo:
    case ERROR_DE_DUPLICADO.ambos:
      return motivoDeDuplicado(campo, mio);
  }
}

/** La tarjeta de un conflicto de sincronización. */
export function vistaDeConflictoDeSync(c: ConflictoAMostrar, enLinea: boolean): VistaDeConflicto {
  const { campo } = c.conflicto;
  const origenMio = c.motivo ? `${ORIGEN_MIO} · ${NO_DISPONIBLE}` : ORIGEN_MIO;
  return {
    titulo: ETIQUETA_DE_CAMPO_DE_SYNC[campo],
    mio: { origen: origenMio, ...opcion(c, LADO.mio, enLinea) },
    otro: opcionDelServidor(c, enLinea),
    nota: nota(c),
    motivo: c.motivo ? textoDeMotivo(c.motivo, c.conflicto) : null,
  };
}
