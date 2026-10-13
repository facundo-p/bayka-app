import { leerNombreOrganizacion } from '../queries/fichasQueries';

/** Sin organización legible el PDF sale igual: el encabezado lleva solo el código de la plantación. */
export function leerOrganizacionDelEncabezado(plantacionId: string): Promise<string | null> {
  return leerNombreOrganizacion(plantacionId).catch(() => null);
}
