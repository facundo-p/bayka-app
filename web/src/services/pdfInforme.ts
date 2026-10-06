/*
 * Informe PDF de la plantación (#756): reutiliza las lecturas cacheadas del
 * dashboard, del mapa y de las parcelas, y arma el documento en el navegador.
 * Todo lo de PDF se carga recién acá, con `import()`.
 */
import type { QueryClient } from '@tanstack/react-query';
import { formatearFechaCorta } from '../lib/fechas';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { calcularDashboard, obtenerFuenteDashboard } from '../queries/dashboardQueries';
import { listarParcelasConStats } from '../queries/dataExplorerQueries';
import { leerNombreOrganizacion } from '../queries/fichasQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import { ETIQUETA_ESTADO_PLANTACION, type Plantacion } from '../queries/plantationQueries';
import { descargarBlob, EXTENSION_PDF, nombreArchivoDescarga } from './descargas';

export type PlantacionDelInforme = Pick<
  Plantacion,
  'id' | 'lugar' | 'periodo' | 'codigo' | 'estado' | 'objetivoArboles'
>;

const PREFIJO_ARCHIVO_INFORME = 'informe';

/**
 * Las mismas claves y funciones que el dashboard: lo que ya leyó y sigue
 * vigente no se vuelve a pedir, y lo que se relee le llega también al dashboard.
 */
function leerInsumos(id: string, queryClient: QueryClient) {
  return Promise.all([
    queryClient.fetchQuery({
      queryKey: CLAVE_QUERY.dashboard(id),
      queryFn: () => obtenerFuenteDashboard(id),
    }),
    // El mapa es accesorio: si no se lee, el informe sale con «Mapa no disponible».
    queryClient
      .fetchQuery({ queryKey: CLAVE_QUERY.mapa(id), queryFn: () => listarPuntosGps(id) })
      .catch(() => null),
    queryClient.fetchQuery({
      queryKey: CLAVE_QUERY.datosParcelas(id),
      queryFn: () => listarParcelasConStats(id),
    }),
    // Sin organización legible, el encabezado lleva solo el código.
    leerNombreOrganizacion(id).catch(() => null),
    import('../pdf/informe/motorInforme'),
  ]);
}

/** El informe de la plantación entera, aunque el dashboard tenga una parcela filtrada. */
export async function generarPdfInforme(
  plantacion: PlantacionDelInforme,
  queryClient: QueryClient,
): Promise<Blob> {
  const [fuente, puntos, parcelas, organizacion, motor] = await leerInsumos(
    plantacion.id,
    queryClient,
  );
  return motor.renderizarInforme({
    dashboard: calcularDashboard(fuente, null),
    puntos,
    parcelas,
    plantacion: { ...plantacion, estado: ETIQUETA_ESTADO_PLANTACION[plantacion.estado] },
    objetivo: plantacion.objetivoArboles,
    organizacion,
    emitido: formatearFechaCorta(new Date().toISOString()),
  });
}

/** `informe-<lugar>-<periodo>.pdf`. */
export function nombreArchivoInforme(lugar: string, periodo: string): string {
  return nombreArchivoDescarga(PREFIJO_ARCHIVO_INFORME, lugar, periodo, EXTENSION_PDF);
}

export async function descargarInformePdf(
  plantacion: PlantacionDelInforme,
  queryClient: QueryClient,
): Promise<void> {
  const blob = await generarPdfInforme(plantacion, queryClient);
  descargarBlob(blob, nombreArchivoInforme(plantacion.lugar, plantacion.periodo));
}
