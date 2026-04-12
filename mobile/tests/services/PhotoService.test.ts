// Tests for PhotoService — unit tests using mocked expo-file-system (new API) and expo-image-picker
// Covers: launchCamera, launchGallery (permission granted/denied, canceled, resizeAndSaveToDocument)

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///tmp/resized.jpg' }),
  SaveFormat: { JPEG: 'jpeg' },
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
  function MockDirectory(this: any, _base: string, _name?: string) {
    Object.defineProperty(this, 'exists', {
      get: () => mockState.dirExists,
    });
    this.create = (_opts?: any) => {
      mockState.dirCreateCalled++;
    };
  }

  function MockFile(this: any, _pathOrDir: any, name?: string) {
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
import * as ImageManipulator from 'expo-image-manipulator';
import { launchCamera, launchGallery } from '../../src/services/PhotoService';

describe('PhotoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.fileCopyCalled = 0;
    mockState.dirCreateCalled = 0;
    mockState.dirExists = true;
    // Re-apply default manipulateAsync mock after clearAllMocks
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file:///tmp/resized.jpg' });
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

    it('returns permanent URI after resizing and saving to document directory', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://temp/photo_temp.jpg', width: 1920, height: 1080 }],
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
        assets: [{ uri: 'file://temp/photo_temp.jpg', width: 1920, height: 1080 }],
      });
      mockState.dirExists = false;

      await launchCamera();

      expect(mockState.dirCreateCalled).toBe(1);
    });

    it('calls manipulateAsync with width:1600 for landscape photo', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/photo.jpg', width: 3200, height: 2400 }],
      });

      await launchCamera();

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file:///tmp/photo.jpg',
        [{ resize: { width: 1600 } }],
        expect.objectContaining({ format: ImageManipulator.SaveFormat.JPEG })
      );
    });

    it('calls manipulateAsync with height:1600 for portrait photo', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/photo.jpg', width: 2400, height: 3200 }],
      });

      await launchCamera();

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file:///tmp/photo.jpg',
        [{ resize: { height: 1600 } }],
        expect.objectContaining({ format: ImageManipulator.SaveFormat.JPEG })
      );
    });

    it('uses quality: 1 in picker options', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/photo.jpg', width: 1920, height: 1080 }],
      });

      await launchCamera();

      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 1 })
      );
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

    it('returns permanent URI after resizing and saving selected gallery photo', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://gallery/photo_gallery.jpg', width: 1920, height: 1080 }],
      });

      const result = await launchGallery();

      expect(mockState.fileCopyCalled).toBe(1);
      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
    });
  });
});
