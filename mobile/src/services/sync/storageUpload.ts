import { supabase } from '../../supabase/client';
import { File as ExpoFile } from 'expo-file-system';

/**
 * Uploads a local photo file to the `tree-photos` Storage bucket. Shared by
 * pushService (group sync) and photoService (standalone photo sync) — both
 * upload the same way, just at different points in the sync flow.
 */
export async function uploadPhotoToStorage(
  localUri: string,
  storagePath: string
): Promise<{ error: Error | null }> {
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

    return { error: error ? new Error(error.message) : null };
  } catch (e: any) {
    return { error: e };
  }
}
