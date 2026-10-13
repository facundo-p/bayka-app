/*
 * Informe PDF de la plantación (#756): reutiliza las lecturas cacheadas del
 * dashboard, del mapa y de las especies, y arma el documento en el navegador.
 * Todo lo de PDF se carga recién acá, con `import()`.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { OpcionesInforme } from '../lib/opcionesInforme';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { calcularDashboard, obtenerFuenteDashboard } from '../queries/dashboardQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import { ETIQUETA_ESTADO_PLANTACION, type Plantacion } from '../queries/plantationQueries';
import { leerColoresEspecie } from './coloresDePlantacion';
import { descargarBlob, EXTENSION_PDF, nombreArchivoDescarga } from './descargas';
import { leerOrganizacionDelInforme } from './organizacionInforme';

export type PlantacionDelInforme = Pick<
  Plantacion,
  'id' | 'lugar' | 'periodo' | 'codigo' | 'estado' | 'objetivoArboles'
>;

const PREFIJO_ARCHIVO_INFORME = 'informe';

/** Sin mapa elegido no se piden; si no se pueden leer, el informe sale con «Mapa no disponible». */
function leerPuntos(id: string, queryClient: QueryClient, opciones: OpcionesInforme) {
  if (!opciones.mapa) return Promise.resolve(null);
  return queryClient
    .fetchQuery({ queryKey: CLAVE_QUERY.mapa(id), queryFn: () => listarPuntosGps(id) })
    .catch(() => null);
}

/** Lo que puede faltar: el informe sale igual, sin esa parte. */
function leerAccesorios(id: string, queryClient: QueryClient, opciones: OpcionesInforme) {
  return Promise.all([leerPuntos(id, queryClient, opciones), leerOrganizacionDelInforme(id)]);
}

/**
 * Las mismas claves y funciones que el dashboard: lo que ya leyó y sigue
 * vigente no se vuelve a pedir, y lo que se relee le llega también al dashboard.
 */
function leerInsumos(id: string, queryClient: QueryClient, opciones: OpcionesInforme) {
  return Promise.all([
    queryClient.fetchQuery({
      queryKey: CLAVE_QUERY.dashboard(id),
      queryFn: () => obtenerFuenteDashboard(id),
    }),
    leerAccesorios(id, queryClient, opciones),
    // Los colores del dashboard, el KML y la ficha; sin especies legibles, por hash.
    leerColoresEspecie(queryClient, id),
    import('../pdf/informe/motorInforme'),
  ]);
}

/** El informe de la plantación entera, aunque el dashboard tenga una parcela filtrada. */
export async function generarPdfInforme(
  plantacion: PlantacionDelInforme,
  queryClient: QueryClient,
  opciones: OpcionesInforme,
): Promise<Blob> {
  const [fuente, [puntos, organizacion], colorDe, motor] = await leerInsumos(
    plantacion.id,
    queryClient,
    opciones,
  );
  return motor.renderizarInforme({
    ...motor.emisionDePlantacion(plantacion),
    dashboard: calcularDashboard(fuente),
    puntos,
    plantacion: { ...plantacion, estado: ETIQUETA_ESTADO_PLANTACION[plantacion.estado] },
    objetivo: plantacion.objetivoArboles,
    organizacion,
    colorDe,
    opciones,
  });
}

/** `informe-<lugar>-<periodo>.pdf`. */
export function nombreArchivoInforme(lugar: string, periodo: string): string {
  return nombreArchivoDescarga(PREFIJO_ARCHIVO_INFORME, lugar, periodo, EXTENSION_PDF);
}

export async function descargarInformePdf(
  plantacion: PlantacionDelInforme,
  queryClient: QueryClient,
  opciones: OpcionesInforme,
): Promise<void> {
  const blob = await generarPdfInforme(plantacion, queryClient, opciones);
  descargarBlob(blob, nombreArchivoInforme(plantacion.lugar, plantacion.periodo));
}
