// Gate de captura por el toggle de medición de GPS (#121): con la medición
// desactivada, attachGpsCapture no escribe coordenadas ni pide un fix fresco
// (no se prende el GPS). El camino "medición ON" lo cubre la integración
// tree-gps-capture.test.ts (default habilitado).

const mockUpdateTreeGps = jest.fn();
const mockGetCurrentGpsFix = jest.fn();
const mockGetGpsEnabled = jest.fn();

jest.mock('../../src/repositories/TreeRepository', () => ({
  insertTree: jest.fn(),
  updateTreeGps: (...args: any[]) => mockUpdateTreeGps(...args),
}));

jest.mock('../../src/services/gps/locationClient', () => ({
  getCurrentGpsFix: (...args: any[]) => mockGetCurrentGpsFix(...args),
}));

jest.mock('../../src/services/settings/gpsEnabledStore', () => ({
  getGpsEnabled: () => mockGetGpsEnabled(),
}));

jest.mock('../../src/utils/gpsLogger', () => ({
  gpsLog: { info: jest.fn(), error: jest.fn() },
}));

import { attachGpsCapture } from '../../src/services/gps/gpsCaptureService';

describe('attachGpsCapture — gate por medición de GPS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('medición desactivada: no captura, no pide fix fresco, no escribe coordenadas', async () => {
    mockGetGpsEnabled.mockReturnValue(false);

    const result = await attachGpsCapture('tree-1', null, 1000);

    expect(result).toBe(false);
    expect(mockGetCurrentGpsFix).not.toHaveBeenCalled();
    expect(mockUpdateTreeGps).not.toHaveBeenCalled();
  });
});
