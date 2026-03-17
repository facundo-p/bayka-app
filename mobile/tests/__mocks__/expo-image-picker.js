module.exports = {
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file://mock/photo.jpg' }] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: false, assets: [{ uri: 'file://mock/gallery.jpg' }] }),
  MediaTypeOptions: { Images: 'Images' },
  MediaType: { images: 'images' },
};
