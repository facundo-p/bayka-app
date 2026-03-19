import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

// CRITICAL (Pitfall 1): Always copy from temp picker URI to permanent documentDirectory.
// Picker temp URIs may be gone after app restart or OS memory pressure.
async function copyToDocument(tempUri: string): Promise<string> {
  const filename = `photo_${Date.now()}.jpg`;
  const dir = `${FileSystem.documentDirectory}photos/`;
  const dest = `${dir}${filename}`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.copyAsync({ from: tempUri, to: dest });
  return dest;
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
