import { and, eq, isNull } from 'drizzle-orm';
import { plantations } from '../database/schema';

/** El server ya tiene la plantación: ni sin subir (pendingSync) ni eliminada allá (#478). */
export const plantacionSubida = and(eq(plantations.pendingSync, false), isNull(plantations.eliminadaEnServidorEn));
