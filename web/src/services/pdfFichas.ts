/*
 * Ficha PDF de un árbol (#754): lee lo que falta, prepara la foto y el minimapa
 * y arma el documento en el navegador. Todo lo de PDF se carga recién acá, con
 * `import()`.
 */
import type { QueryClient } from '@tanstack/react-query';
import { formatearFechaCorta } from '../lib/fechas';
import { nombreTecnicoDe } from '../lib/formato';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import {
  leerArbolParaFicha,
  leerNombreOrganizacion,
  type ArbolParaFicha,
} from '../queries/fichasQueries';
import { listarPuntosGps, type PuntoGps } from '../queries/mapaQueries';
import type { Plantacion } from '../queries/plantationQueries';
import type { ColorEspecie } from '../theme/coloresEspecie';
import { coloresDeHabilitadas, leerEspeciesHabilitadas } from './coloresDePlantacion';
import { descargarBlob, EXTENSION_PDF, nombreArchivoDescarga } from './descargas';

export type ContextoFichasPdf = {
  plantacion: Pick<Plantacion, 'id' | 'lugar' | 'periodo' | 'codigo'>;
  /** Nombre visible de cada usuario por id, para el técnico de la ficha. */
  nombresUsuario: ReadonlyMap<string, string>;
  /** Los puntos del mapa salen de su caché si el dashboard ya los leyó. */
  queryClient: QueryClient;
};

/**
 * Los puntos solo pintan a los vecinos del minimapa (el árbol sale de su fila):
 * unos minutos viejos alcanzan y evitan releer toda la plantación por ficha. Un
 * cambio de especie invalida la caché y fuerza la relectura igual.
 */
const VIGENCIA_PUNTOS_MS = 5 * 60_000;
const PREFIJO_ARCHIVO_FICHA = 'ficha';

export const ERROR_FICHA_SIN_ARBOL = 'No se encontró el árbol de la ficha';

/** Los vecinos del minimapa son accesorios: si no se leen, el mapa muestra solo el árbol. */
function leerPuntos({ plantacion, queryClient }: ContextoFichasPdf): Promise<PuntoGps[]> {
  return queryClient
    .fetchQuery({
      queryKey: CLAVE_QUERY.mapa(plantacion.id),
      queryFn: () => listarPuntosGps(plantacion.id),
      staleTime: VIGENCIA_PUNTOS_MS,
    })
    .catch(() => []);
}

/** Sin organización legible, el encabezado lleva solo el código de la plantación. */
function leerInsumos(arbolId: string, contexto: ContextoFichasPdf) {
  const { id } = contexto.plantacion;
  return Promise.all([
    leerArbolParaFicha(id, arbolId),
    leerNombreOrganizacion(id).catch(() => null),
    leerPuntos(contexto),
    leerEspeciesHabilitadas(contexto.queryClient, id),
    import('../pdf/ficha/motorFichas'),
  ]);
}

type MotorFichas = typeof import('../pdf/ficha/motorFichas');

/** Lo de la plantación que necesita la ficha. */
type InsumosFicha = {
  puntos: PuntoGps[];
  colorDe: ColorEspecie;
  nombres: ReadonlyMap<string, string>;
};

/** Modelo de la ficha con su foto y su minimapa ya rasterizados. */
async function prepararFicha(
  motor: MotorFichas,
  arbol: ArbolParaFicha,
  { puntos, colorDe, nombres }: InsumosFicha,
) {
  const [[foto], mapa] = await Promise.all([
    motor.cargarFotos([arbol.fotoUrl]),
    motor.minimapaDeArbol(arbol, puntos, colorDe),
  ]);
  return motor.datosFicha(arbol, { tecnico: nombreTecnicoDe(arbol, nombres), foto, mapa, colorDe });
}

async function generarPdfFicha(arbolId: string, contexto: ContextoFichasPdf) {
  const [arbol, organizacion, puntos, especies, motor] = await leerInsumos(arbolId, contexto);
  if (!arbol) throw new Error(ERROR_FICHA_SIN_ARBOL);
  const colorDe = coloresDeHabilitadas(especies);
  const nombres = contexto.nombresUsuario;
  const ficha = await prepararFicha(motor, arbol, { puntos, colorDe, nombres });
  const logo = motor.logoNavegador();
  const encabezado = motor.encabezadoDePlantacion(contexto.plantacion, organizacion, logo);
  const emitido = formatearFechaCorta(new Date().toISOString());
  return { blob: await motor.renderizarFichas({ encabezado, emitido, fichas: [ficha] }), arbol };
}

/** `ficha-<lugar>-<periodo>-<subid>.pdf`. */
export function nombreArchivoFicha(lugar: string, periodo: string, subId: string): string {
  return nombreArchivoDescarga(PREFIJO_ARCHIVO_FICHA, lugar, periodo, EXTENSION_PDF, subId);
}

export async function descargarFichaPdf(
  arbolId: string,
  contexto: ContextoFichasPdf,
): Promise<void> {
  const { blob, arbol } = await generarPdfFicha(arbolId, contexto);
  const { lugar, periodo } = contexto.plantacion;
  descargarBlob(blob, nombreArchivoFicha(lugar, periodo, arbol.subId));
}
