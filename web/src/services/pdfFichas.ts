/*
 * Fichas PDF de árboles (#754): lee lo que falta, prepara fotos y minimapas y
 * arma el documento en el navegador. Todo lo de PDF se carga recién acá, con
 * `import()`.
 */
import type { QueryClient } from '@tanstack/react-query';
import { mapearConConcurrencia } from '../lib/concurrencia';
import { formatearFechaCorta } from '../lib/fechas';
import { nombreTecnicoDe } from '../lib/formato';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import {
  leerNombreOrganizacion,
  listarArbolesParaFichas,
  type ArbolParaFicha,
} from '../queries/fichasQueries';
import { listarPuntosGps, type PuntoGps } from '../queries/mapaQueries';
import type { Plantacion } from '../queries/plantationQueries';
import type { ColorEspecie } from '../theme/coloresEspecie';
import { leerColoresEspecie } from './coloresDePlantacion';
import { descargarBlob, EXTENSION_PDF, nombreArchivoDescarga } from './descargas';

export type ContextoFichasPdf = {
  plantacion: Pick<Plantacion, 'id' | 'lugar' | 'periodo' | 'codigo'>;
  /** Nombre visible de cada usuario por id, para el técnico de cada ficha. */
  nombresUsuario: ReadonlyMap<string, string>;
  /** Los puntos del mapa salen de su caché si el dashboard ya los leyó. */
  queryClient: QueryClient;
};

export type FichasPdf = { blob: Blob; arboles: ArbolParaFicha[] };

/**
 * Los puntos solo pintan a los vecinos del minimapa (el árbol sale de su fila):
 * unos minutos viejos alcanzan y evitan releer toda la plantación por ficha. Un
 * cambio de especie invalida la caché y fuerza la relectura igual.
 */
const VIGENCIA_PUNTOS_MS = 5 * 60_000;
const PREFIJO_ARCHIVO_FICHAS = { una: 'ficha', varias: 'fichas' } as const;
/** Pocos canvas y mosaicos decodificados a la vez: 50 minimapas juntos serían 800 tiles en memoria. */
const MINIMAPAS_SIMULTANEOS = 4;

export const ERROR_FICHAS_SIN_ARBOLES = 'No se encontraron los árboles de las fichas';

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
function leerInsumos(ids: readonly string[], contexto: ContextoFichasPdf) {
  const { id } = contexto.plantacion;
  return Promise.all([
    listarArbolesParaFichas(id, ids),
    leerNombreOrganizacion(id).catch(() => null),
    leerPuntos(contexto),
    leerColoresEspecie(contexto.queryClient, id),
    import('../pdf/ficha/motorFichas'),
  ]);
}

type MotorFichas = typeof import('../pdf/ficha/motorFichas');

/** Lo de la plantación que comparten todas las fichas. */
type InsumosFichas = {
  puntos: PuntoGps[];
  colorDe: ColorEspecie;
  nombres: ReadonlyMap<string, string>;
};

/** Modelos de las fichas con sus fotos y minimapas ya rasterizados. */
async function prepararFichas(
  motor: MotorFichas,
  arboles: ArbolParaFicha[],
  { puntos, colorDe, nombres }: InsumosFichas,
) {
  const [fotos, mapas] = await Promise.all([
    motor.cargarFotos(arboles.map((arbol) => arbol.fotoUrl)),
    mapearConConcurrencia(arboles, MINIMAPAS_SIMULTANEOS, (arbol) =>
      motor.minimapaDeArbol(arbol, puntos, colorDe),
    ),
  ]);
  return arboles.map((arbol, indice) =>
    motor.datosFicha(arbol, {
      tecnico: nombreTecnicoDe(arbol, nombres),
      foto: fotos[indice],
      mapa: mapas[indice],
      colorDe,
    }),
  );
}

/** El PDF de las fichas, en el orden de `ids`. */
export async function generarPdfFichas(
  ids: readonly string[],
  contexto: ContextoFichasPdf,
): Promise<FichasPdf> {
  const [arboles, organizacion, puntos, colorDe, motor] = await leerInsumos(ids, contexto);
  if (arboles.length === 0) throw new Error(ERROR_FICHAS_SIN_ARBOLES);
  const nombres = contexto.nombresUsuario;
  const fichas = await prepararFichas(motor, arboles, { puntos, colorDe, nombres });
  const logo = motor.logoNavegador();
  const encabezado = motor.encabezadoDePlantacion(contexto.plantacion, organizacion, logo);
  const emitido = formatearFechaCorta(new Date().toISOString());
  return { blob: await motor.renderizarFichas({ encabezado, emitido, fichas }), arboles };
}

/** `ficha-<lugar>-<periodo>-<subid>.pdf`. */
export function nombreArchivoFicha(lugar: string, periodo: string, subId: string): string {
  return nombreArchivoDescarga(PREFIJO_ARCHIVO_FICHAS.una, lugar, periodo, EXTENSION_PDF, subId);
}

/** `fichas-<lugar>-<periodo>.pdf`. */
export function nombreArchivoFichas(lugar: string, periodo: string): string {
  return nombreArchivoDescarga(PREFIJO_ARCHIVO_FICHAS.varias, lugar, periodo, EXTENSION_PDF);
}

export async function descargarFichasPdf(
  ids: readonly string[],
  contexto: ContextoFichasPdf,
): Promise<void> {
  const { blob } = await generarPdfFichas(ids, contexto);
  const { lugar, periodo } = contexto.plantacion;
  descargarBlob(blob, nombreArchivoFichas(lugar, periodo));
}

export async function descargarFichaPdf(
  arbolId: string,
  contexto: ContextoFichasPdf,
): Promise<void> {
  const { blob, arboles } = await generarPdfFichas([arbolId], contexto);
  const { lugar, periodo } = contexto.plantacion;
  descargarBlob(blob, nombreArchivoFicha(lugar, periodo, arboles[0].subId));
}
