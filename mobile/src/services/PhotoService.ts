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

async function launchCamera(): Promise<string | null> {
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

async function launchGallery(): Promise<string | null> {
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

/**
 * Shows a picker dialog (camera / gallery) and returns the photo path.
 * Returns null if user cancels. Used for all photo capture in the app.
 */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const { Alert } = require('react-native');
    Alert.alert(
      'Agregar foto',
      '¿Cómo querés agregar la foto?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Galería', onPress: () => launchGallery().then(resolve) },
        { text: 'Cámara', onPress: () => launchCamera().then(resolve) },
      ]
    );
  });
}

/**
 * Opens camera for N/N tree registration.
 * Shows camera/gallery picker. Returns permanent file path or null.
 * Photo is MANDATORY for N/N — caller should abort registration if null.
 */
export async function captureNNPhoto(): Promise<string | null> {
  return pickPhoto();
}

/**
 * Attaches a photo to any tree (optional feature).
 * Shows camera/gallery picker. Returns permanent path or null.
 */
export async function attachTreePhoto(): Promise<string | null> {
  return pickPhoto();
}
