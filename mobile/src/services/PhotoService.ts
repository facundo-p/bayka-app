import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';

// CRITICAL (Pitfall 1): Always copy from temp picker URI to permanent Paths.document.
// Picker temp URIs may be gone after app restart or OS memory pressure.
function copyToDocument(tempUri: string): string {
  const filename = `photo_${Date.now()}.jpg`;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  const dest = new File(dir, filename);
  const source = new File(tempUri);
  source.copy(dest);
  return dest.uri;
}

export async function launchCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return copyToDocument(result.assets[0].uri);
}

export async function launchGallery(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return copyToDocument(result.assets[0].uri);
}
