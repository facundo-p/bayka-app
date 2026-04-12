import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// CRITICAL (Pitfall 1): Always copy from temp picker URI to permanent Paths.document.
// Picker temp URIs may be gone after app restart or OS memory pressure.
// Pitfall 3: Use quality: 1 at capture and let manipulateAsync handle compression (single-pass JPEG).
async function resizeAndSaveToDocument(
  tempUri: string,
  width: number | undefined,
  height: number | undefined
): Promise<string> {
  const filename = `photo_${Date.now()}.jpg`;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  const resize = width !== undefined ? { width } : { height };
  const result = await manipulateAsync(
    tempUri,
    [{ resize }],
    { compress: 0.85, format: SaveFormat.JPEG }
  );

  const dest = new File(dir, filename);
  const source = new File(result.uri);
  source.copy(dest);
  return dest.uri;
}

export async function launchCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const isLandscape = (asset.width ?? 0) >= (asset.height ?? 0);
  return resizeAndSaveToDocument(
    asset.uri,
    isLandscape ? 1600 : undefined,
    isLandscape ? undefined : 1600
  );
}

export async function launchGallery(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const isLandscape = (asset.width ?? 0) >= (asset.height ?? 0);
  return resizeAndSaveToDocument(
    asset.uri,
    isLandscape ? 1600 : undefined,
    isLandscape ? undefined : 1600
  );
}

// Test-only export (underscore convention for test-only exports)
export { resizeAndSaveToDocument as _resizeForTest };
