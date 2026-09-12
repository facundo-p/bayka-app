/** Reglas de captura de foto en la botonera de registro (#439): lógica pura, sin UI ni DB. */
import { PHOTO_CAPTURE_REQUIRED_DEFAULT } from '../../constants/photoCapture';

export interface PickPhotoOptions {
  /** La foto es opcional: el selector ofrece "Sin foto" en vez de "Cancelar". */
  optional?: boolean;
}

/** Selector de foto de la pantalla; resuelve la URI final o null si no hubo foto. */
export type PickPhoto = (options?: PickPhotoOptions) => Promise<string | null>;

export interface PhotoPolicy {
  /** Si se pide foto antes de insertar el árbol. */
  capture: boolean;
  /** Si sin foto el árbol no se registra (solo cuenta con `capture`). */
  required: boolean;
}

/** N/N: la foto es la única identificación del árbol, siempre se pide y siempre es obligatoria. */
export const NN_PHOTO_POLICY: PhotoPolicy = { capture: true, required: true };

/** Especie identificada: pide foto solo si la plantación activó "foto en todos los botones"; la obligatoriedad hoy es una constante. */
export function speciesPhotoPolicy(photoCaptureAllTrees: boolean): PhotoPolicy {
  return { capture: photoCaptureAllTrees, required: PHOTO_CAPTURE_REQUIRED_DEFAULT };
}

export type PhotoForRegistration =
  | { proceed: true; fotoUrl: string | null }
  | { proceed: false };

/** Aplica la política antes del alta: sin captura sigue sin foto; con foto sigue; sin foto, aborta si es obligatoria o sigue sin foto si es opcional. */
export async function resolvePhotoForRegistration(
  policy: PhotoPolicy,
  pickPhoto: PickPhoto,
): Promise<PhotoForRegistration> {
  if (!policy.capture) return { proceed: true, fotoUrl: null };
  const fotoUrl = await pickPhoto({ optional: !policy.required });
  if (fotoUrl) return { proceed: true, fotoUrl };
  return policy.required ? { proceed: false } : { proceed: true, fotoUrl: null };
}
