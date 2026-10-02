const mockCopy = jest.fn();
const mockDelete = jest.fn();
let mockExists = false;

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((dirOrUri: unknown, name?: string) => ({
    uri: name ? `file:///cache/${name}` : dirOrUri,
    get exists() {
      return mockExists;
    },
    copy: mockCopy,
    delete: mockDelete,
  })),
  Paths: { cache: {} },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn().mockResolvedValue({ id: 'asset-1' }),
  getAlbumAsync: jest.fn(),
  addAssetsToAlbumAsync: jest.fn().mockResolvedValue(true),
  createAlbumAsync: jest.fn().mockResolvedValue({}),
}));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: jest.fn() } }));
jest.mock('../../src/queries/treeQueries', () => ({ getDatosNombreDeFoto: jest.fn() }));
jest.mock('../../src/services/sync/photoService', () => ({ descargarFotoRemota: jest.fn() }));

import NetInfo from '@react-native-community/netinfo';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { getDatosNombreDeFoto } from '../../src/queries/treeQueries';
import { descargarFotoRemota } from '../../src/services/sync/photoService';
import {
  asegurarFotoLocal,
  compartirFoto,
  guardarFotoEnGaleria,
} from '../../src/services/FotoExportService';

const ml = MediaLibrary as jest.Mocked<typeof MediaLibrary>;
const datos = { subId: 'A-12', lugar: 'Finca "El Álamo"', periodo: '2026' };

beforeEach(() => {
  jest.clearAllMocks();
  mockExists = false;
  (getDatosNombreDeFoto as jest.Mock).mockResolvedValue(datos);
});

describe('guardarFotoEnGaleria', () => {
  it('con permiso denegado no copia ni guarda nada', async () => {
    ml.requestPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const res = await guardarFotoEnGaleria('file:///photos/a.jpg', 't1');
    expect(res).toBe('sin-permiso');
    expect(mockCopy).not.toHaveBeenCalled();
    expect(ml.createAssetAsync).not.toHaveBeenCalled();
  });

  it('pide permiso solo de escritura y crea el álbum Bayka con el nombre legible', async () => {
    ml.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    ml.getAlbumAsync.mockResolvedValue(null as never);
    const res = await guardarFotoEnGaleria('file:///photos/a.jpg', 't1');
    expect(res).toBe('guardada');
    expect(ml.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(ml.createAssetAsync).toHaveBeenCalledWith('file:///cache/foto-finca-el-alamo-2026-a-12.jpg');
    expect(ml.createAlbumAsync).toHaveBeenCalledWith('Bayka', { id: 'asset-1' }, false);
  });

  it('con el álbum ya creado agrega el asset en vez de crearlo', async () => {
    ml.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    const album = { id: 'alb' };
    ml.getAlbumAsync.mockResolvedValue(album as never);
    await guardarFotoEnGaleria('file:///photos/a.jpg', 't1');
    expect(ml.addAssetsToAlbumAsync).toHaveBeenCalledWith([{ id: 'asset-1' }], album, false);
    expect(ml.createAlbumAsync).not.toHaveBeenCalled();
  });

  it('pisa la copia anterior en cache', async () => {
    ml.requestPermissionsAsync.mockResolvedValue({ granted: true } as never);
    ml.getAlbumAsync.mockResolvedValue(null as never);
    mockExists = true;
    await guardarFotoEnGaleria('file:///photos/a.jpg', 't1');
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('compartirFoto', () => {
  it('copia a cache con nombre legible y abre la hoja de compartir', async () => {
    const res = await compartirFoto('file:///photos/a.jpg', 't1');
    expect(res).toBe('compartida');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/foto-finca-el-alamo-2026-a-12.jpg',
      expect.objectContaining({ mimeType: 'image/jpeg' }),
    );
  });
});

describe('asegurarFotoLocal', () => {
  it('una foto local se usa tal cual, sin mirar la red', async () => {
    const res = await asegurarFotoLocal('file:///photos/a.jpg', 't1');
    expect(res).toEqual({ uri: 'file:///photos/a.jpg', descargadaAhora: false });
    expect(NetInfo.fetch).not.toHaveBeenCalled();
  });

  it('una foto en la nube sin conexión da null y no intenta bajarla', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });
    expect(await asegurarFotoLocal('plantacion/t1.jpg', 't1')).toBeNull();
    expect(descargarFotoRemota).not.toHaveBeenCalled();
  });

  it('una foto en la nube con conexión se baja y avisa que se bajó ahora', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    (descargarFotoRemota as jest.Mock).mockResolvedValue('file:///photos/t1.jpg');
    expect(await asegurarFotoLocal('plantacion/t1.jpg', 't1')).toEqual({
      uri: 'file:///photos/t1.jpg',
      descargadaAhora: true,
    });
  });

  it('si la descarga falla da null', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    (descargarFotoRemota as jest.Mock).mockResolvedValue(null);
    expect(await asegurarFotoLocal('plantacion/t1.jpg', 't1')).toBeNull();
  });
});
