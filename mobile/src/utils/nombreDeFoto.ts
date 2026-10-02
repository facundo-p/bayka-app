import { aSlug } from './aSlug';

const NOMBRE_SIN_DATOS = 'foto.jpg';

/** Nombre `foto-<lugar>-<periodo>-<subId>.jpg` por slug; sin ninguna parte, `foto.jpg`. */
export function nombreDeFoto(lugar: string, periodo: string, subId: string): string {
  const partes = [aSlug(lugar), aSlug(periodo), aSlug(subId)].filter(Boolean);
  return partes.length > 0 ? `foto-${partes.join('-')}.jpg` : NOMBRE_SIN_DATOS;
}
