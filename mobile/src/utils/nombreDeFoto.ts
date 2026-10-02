import { aSlug } from './aSlug';

/** Nombre descriptivo `foto-<lugar>-<periodo>-<subId>.jpg`, sin partes vacías tras el slug. */
export function nombreDeFoto(lugar: string, periodo: string, subId: string): string {
  const partes = [aSlug(lugar), aSlug(periodo), aSlug(subId)].filter(Boolean);
  return `foto-${partes.join('-')}.jpg`;
}
