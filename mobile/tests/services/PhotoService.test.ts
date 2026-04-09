// Tests for PhotoService — unit tests using mocked expo-file-system (new API) and expo-image-picker
// Covers: launchCamera, launchGallery (permission granted/denied, canceled, copyToDocument)

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Shared state object — referenced inside jest.mock factory via closure.
// jest.mock factories are hoisted but closures over module-scope variables still work
// because the variable is in scope when the factory executes.
const mockState = {
  fileCopyCalled: 0,
  dirCreateCalled: 0,
  dirExists: true,
};

// Mock the new expo-file-system API using constructor functions so `new Directory()` works.
jest.mock('expo-file-system', () => {
  function MockDirectory(_base: string, _name?: string) {
    Object.defineProperty(this, 'exists', {
      get: () => mockState.dirExists,
    });
    this.create = (_opts?: any) => {
      mockState.dirCreateCalled++;
    };
  }

  function MockFile(_pathOrDir: any, name?: string) {
    this.uri = name ? `file://document/photos/${name}` : 'file://source/temp.jpg';
    this.copy = (_dest: any) => {
      mockState.fileCopyCalled++;
    };
  }

  return {
    Directory: MockDirectory,
    File: MockFile,
    Paths: { document: 'file://document' },
  };
});

import * as ImagePicker from 'expo-image-picker';
import { launchCamera, launchGallery } from '../../src/services/PhotoService';

describe('PhotoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fileCopyCalled = 0;
    mockState.dirCreateCalled = 0;
    mockState.dirExists = true;
  });

  describe('launchCamera', () => {
    it('returns null when camera permission is denied', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      const result = await launchCamera();

      expect(result).toBeNull();
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });

    it('returns null when user cancels camera', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

      const result = await launchCamera();

      expect(result).toBeNull();
    });

    it('returns permanent URI after copying temp photo to document directory', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://temp/photo_temp.jpg' }],
      });

      const result = await launchCamera();

      expect(mockState.fileCopyCalled).toBe(1);
      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
    });

    it('creates photos directory when it does not exist', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://temp/photo_temp.jpg' }],
      });
      mockState.dirExists = false;

      await launchCamera();

      expect(mockState.dirCreateCalled).toBe(1);
    });
  });

  describe('launchGallery', () => {
    it('returns null when media library permission is denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      const result = await launchGallery();

      expect(result).toBeNull();
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('returns null when user cancels gallery selection', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

      const result = await launchGallery();

      expect(result).toBeNull();
    });

    it('returns permanent URI after copying selected gallery photo to document directory', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://gallery/photo_gallery.jpg' }],
      });

      const result = await launchGallery();

      expect(mockState.fileCopyCalled).toBe(1);
      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
    });
  });
});
