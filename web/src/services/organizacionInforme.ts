import { leerNombreOrganizacion } from '../queries/fichasQueries';

/** Sin organización legible el informe sale igual, sin ella en el título. */
export function leerOrganizacionDelInforme(plantacionId: string): Promise<string | null> {
  return leerNombreOrganizacion(plantacionId).catch(() => null);
}
