/**
 * Textos de un conflicto de sincronización en "Resolver cambios" (#804): el valor del
 * teléfono contra el del servidor, con su detalle, y por qué no se puede conservar
 * el propio. Lógica pura.
 */
import { distanciaMetros } from '../../../shared/distancia';
import {
  CAMPO_EN_CONFLICTO, ERROR_DE_CONFLICTO, FALLA_AL_RESOLVER, esCampoDeGrupo,
  type CampoEnConflicto, type FallaAlResolver, type PuntoGps,
} from '../constants/conflictoDeSync';
import { ERROR_DE_DUPLICADO, ERROR_DE_EDICION } from '../constants/errorDeEdicion';
import { ESTADO_GRUPO, type EstadoGrupo } from '../constants/estados';
import { GROUP_TIPO_LABELS, esGroupTipo } from '../constants/groupTipo';
import type {
  ConflictoEnContexto, ConflictoParaResolver, EspecieEnConflicto, MotivoSinConservar,
} from '../types/conflictoDeSync';
import { entidadPresente, esFotoQuitada, tieneCoordenadas } from './conflictosDeSync';
import { textoDeMomento } from './textoDeConflicto';
import type { OpcionDeConflicto, VistaDeConflicto } from './vistaDeConflicto';

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
const DECIMALES_GPS = 5;
const METROS_EN_KM = 1000;

const DESCRIPCION_DE_FOTO = { mia: 'Foto sacada en este teléfono', servidor: 'Foto del servidor' } as const;

/** Sin foto de un lado. En el teléfono solo pasa si la quitaron acá. */
const SIN_FOTO = { mia: 'Sin foto (la quitaste)', servidor: 'Sin foto' } as const;

const ADVERTENCIA_DE_FOTO = {
  siQuedaLaDelServidor: 'Si queda la del servidor, la foto sacada en este teléfono se borra.',
  alGuardar: 'Al guardar se borra la foto sacada en este teléfono.',
  siQuedaSinFoto: 'Si queda sin foto, se borra la del servidor.',
} as const;

const AVISO_DE_FALLA: Record<FallaAlResolver, string> = {
  [FALLA_AL_RESOLVER.cambio]: 'Cambió de nuevo mientras elegías. Revisá los valores y guardá otra vez.',
  [FALLA_AL_RESOLVER.error]: 'No se pudo guardar esta elección. Probá de nuevo.',
};

const NOMBRE_DE_ENTIDAD = { grupo: 'grupo', arbol: 'árbol' } as const;

const entidadDe = (campo: CampoEnConflicto) =>
  (esCampoDeGrupo(campo) ? NOMBRE_DE_ENTIDAD.grupo : NOMBRE_DE_ENTIDAD.arbol);

const ETIQUETA_DE_ESTADO: Record<EstadoGrupo, string> = {
  [ESTADO_GRUPO.activa]: 'Activo',
  [ESTADO_GRUPO.finalizada]: 'Finalizado',
  [ESTADO_GRUPO.sincronizada]: 'Finalizado',
};

const esEstadoGrupo = (valor: string): valor is EstadoGrupo => valor in ETIQUETA_DE_ESTADO;

function textoDeEspecie(especie: EspecieEnConflicto | null, especieId: unknown): string {
  if (especie) return `${especie.nombre} (${especie.codigo})`;
  return especieId == null ? 'N/N' : 'Especie que ya no está en el teléfono';
}

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
  if (campo === CAMPO_EN_CONFLICTO.estado) return esEstadoGrupo(valor) ? ETIQUETA_DE_ESTADO[valor] : valor;
  return valor;
}

const puntoDelArbol = (arbol: ConflictoEnContexto['arbol']): PuntoGps | null => arbol && {
  latitude: arbol.latitude, longitude: arbol.longitude, gpsAccuracy: arbol.gpsAccuracy, gpsCapturedAt: arbol.gpsCapturedAt,
};

/** Lo que tiene hoy el árbol o el grupo, que es lo del servidor. */
function valorDelServidor({ conflicto, arbol, grupo }: ConflictoEnContexto): unknown {
  const { campo } = conflicto;
  if (esCampoDeGrupo(campo)) return grupo?.[campo];
  if (campo === CAMPO_EN_CONFLICTO.gps) return puntoDelArbol(arbol);
  if (campo === CAMPO_EN_CONFLICTO.foto) return arbol?.fotoUrl ?? null;
  return arbol?.especieId ?? null;
}

const tieneFoto = (uri: unknown): uri is string => typeof uri === 'string' && uri !== '';

/** El valor y el detalle de un lado: el del teléfono o el del servidor. */
function opcion(c: ConflictoEnContexto, esMio: boolean, enLinea: boolean): Omit<OpcionDeConflicto, 'origen'> {
  const { campo, entidadId } = c.conflicto;
  const valor = esMio ? c.conflicto.mio : valorDelServidor(c);
  switch (campo) {
    case CAMPO_EN_CONFLICTO.especie: return { valor: textoDeEspecie(esMio ? c.especies.mia : c.especies.servidor, valor) };
    case CAMPO_EN_CONFLICTO.gps: return { valor: textoDePunto(valor), detalle: detalleDePunto(valor) };
    case CAMPO_EN_CONFLICTO.foto: {
      if (!tieneFoto(valor)) return { valor: esMio ? SIN_FOTO.mia : SIN_FOTO.servidor };
      const descripcion = esMio ? DESCRIPCION_DE_FOTO.mia : DESCRIPCION_DE_FOTO.servidor;
      return { valor: '', foto: { treeId: entidadId, uri: valor, enLinea, descripcion } };
    }
    default: return { valor: textoDeDatoDeGrupo(campo, valor) };
  }
}

/** Si el árbol o el grupo ya no está, no hay valor del servidor que mostrar. */
function opcionDelServidor(c: ConflictoEnContexto, enLinea: boolean): OpcionDeConflicto {
  if (!entidadPresente(c)) return { origen: ORIGEN_SERVIDOR, valor: `El ${entidadDe(c.conflicto.campo)} ya no existe` };
  return { origen: ORIGEN_SERVIDOR, ...opcion(c, false, enLinea) };
}

function notaDeDistancia(c: ConflictoEnContexto): string | null {
  if (c.conflicto.campo !== CAMPO_EN_CONFLICTO.gps) return null;
  const mio = c.conflicto.mio;
  const servidor = valorDelServidor(c);
  if (!tieneCoordenadas(mio) || !tieneCoordenadas(servidor)) return null;
  const metros = distanciaMetros({ lat: mio.latitude, lng: mio.longitude }, { lat: servidor.latitude, lng: servidor.longitude });
  return `Los dos puntos están a ${textoDeDistancia(metros)}.`;
}

/**
 * La foto propia se borra si queda la del servidor; sin poder conservarla, se borra
 * seguro. Una quitada acá, si se conserva, se lleva la del servidor.
 */
function advertenciaDeFoto({ conflicto, motivo }: ConflictoParaResolver): string | null {
  if (conflicto.campo !== CAMPO_EN_CONFLICTO.foto) return null;
  if (esFotoQuitada(conflicto.mio)) return motivo ? null : ADVERTENCIA_DE_FOTO.siQuedaSinFoto;
  if (!tieneFoto(conflicto.mio)) return null;
  return motivo ? ADVERTENCIA_DE_FOTO.alGuardar : ADVERTENCIA_DE_FOTO.siQuedaLaDelServidor;
}

const nombreDuplicado = (mio: unknown) =>
  `Ya hay otro grupo «${String(mio)}» en esta parcela. Cambiale el nombre al otro grupo o quedate con el del servidor.`;

const codigoDuplicado = (mio: unknown) =>
  `Ya hay otro grupo con el código «${String(mio).toUpperCase()}» en esta parcela. `
  + 'Cambiale el código al otro grupo o quedate con el del servidor.';

function motivoSinValor(campo: CampoEnConflicto, mio: unknown): string {
  switch (campo) {
    case CAMPO_EN_CONFLICTO.especie:
      return mio == null ? 'Dejaste el árbol sin especie; eso no se puede volver a aplicar.' : 'Tu especie ya no está en la plantación.';
    case CAMPO_EN_CONFLICTO.gps: return 'Tu punto GPS quedó incompleto y no se puede volver a aplicar.';
    default: return 'Tu valor no se puede volver a aplicar.';
  }
}

export function textoDeMotivo(motivo: MotivoSinConservar, { campo, mio }: { campo: CampoEnConflicto; mio: unknown }): string {
  switch (motivo) {
    case ERROR_DE_EDICION.plantacionNoEditable: return 'La plantación está finalizada. Para conservar la tuya, pedí que la reabran.';
    case ERROR_DE_EDICION.sinPermiso: return 'No tenés permiso para cambiar los árboles de este grupo.';
    case ERROR_DE_CONFLICTO.inexistente:
      return `Este ${entidadDe(campo)} se borró en otro celular o en la web. Tu cambio no se puede aplicar.`;
    case ERROR_DE_CONFLICTO.sinValor: return motivoSinValor(campo, mio);
    case ERROR_DE_DUPLICADO.nombre: return nombreDuplicado(mio);
    case ERROR_DE_DUPLICADO.codigo: return codigoDuplicado(mio);
    case ERROR_DE_DUPLICADO.ambos: return campo === CAMPO_EN_CONFLICTO.codigo ? codigoDuplicado(mio) : nombreDuplicado(mio);
  }
}

/** Un error sin motivo a la vista se avisa; con motivo, el motivo ya lo explica. */
function avisoDeFalla(falla: FallaAlResolver | undefined, motivo: MotivoSinConservar | null): string | null {
  if (!falla || (falla === FALLA_AL_RESOLVER.error && motivo)) return null;
  return AVISO_DE_FALLA[falla];
}

/** La tarjeta de un conflicto de sincronización. `falla`: por qué no se aplicó al último guardado. */
export function vistaDeConflictoDeSync(c: ConflictoParaResolver, enLinea: boolean, falla?: FallaAlResolver): VistaDeConflicto {
  const { campo } = c.conflicto;
  return {
    titulo: ETIQUETA_DE_CAMPO_DE_SYNC[campo],
    mio: { origen: c.motivo ? `${ORIGEN_MIO} · ${NO_DISPONIBLE}` : ORIGEN_MIO, ...opcion(c, true, enLinea) },
    otro: opcionDelServidor(c, enLinea),
    nota: notaDeDistancia(c),
    advertencia: advertenciaDeFoto(c),
    motivo: c.motivo ? textoDeMotivo(c.motivo, c.conflicto) : null,
    aviso: avisoDeFalla(falla, c.motivo),
  };
}
