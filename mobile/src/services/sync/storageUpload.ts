import { supabase } from '../../supabase/client';
import { File as ExpoFile } from 'expo-file-system';

/**
 * Uploads a local photo file to the `tree-photos` Storage bucket. Shared by
 * pushService (group sync) and photoService (standalone photo sync) — both
 * upload the same way, just at different points in the sync flow.
 *
 * Devuelve los bytes subidos: el archivo ya se materializa entero acá, así que
 * exponerlos no cuesta una sola lectura de más (#450). 0 si la subida falló —lo
 * que no llegó no cuenta para la velocidad.
 */
export async function uploadPhotoToStorage(
  localUri: string,
  storagePath: string
): Promise<{ error: Error | null; bytes: number }> {
  try {
    const file = new ExpoFile(localUri);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from('tree-photos')
      .upload(storagePath, bytes, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) return { error: new Error(error.message), bytes: 0 };
    return { error: null, bytes: bytes.length };
  } catch (e: any) {
    return { error: e, bytes: 0 };
  }
}
