// Punto al toque (#910) y gate por el toggle de medición de GPS (#121). La escritura
// real en DB la cubre tree-gps-capture.test.ts.

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

import { GPS_FIX_MAX_AGE_MS } from '../../src/constants/gpsCapture';
import { attachGpsCapture, capturarGpsAlTap, puntoGpsEnCamino } from '../../src/services/gps/gpsCaptureService';

const TAP_MS = 1_000_000;
const fixDe = (latitude: number, timestamp: number) => ({ latitude, longitude: -60, accuracy: 2, timestamp });

describe('capturarGpsAlTap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(TAP_MS);
    mockGetGpsEnabled.mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('con fix del watcher reciente lo usa y no pide uno nuevo', async () => {
    const watcher = fixDe(-31, TAP_MS - GPS_FIX_MAX_AGE_MS);

    const alTap = capturarGpsAlTap(() => watcher);

    expect(alTap.tapAtMs).toBe(TAP_MS);
    expect(alTap.resueltoAlTap).toBe(true);
    await expect(alTap.fix).resolves.toBe(watcher);
    expect(mockGetCurrentGpsFix).not.toHaveBeenCalled();
  });

  it('con fix del watcher viejo pide uno fresco en el instante del toque', async () => {
    const fresco = fixDe(-32, TAP_MS + 500);
    mockGetCurrentGpsFix.mockResolvedValue(fresco);

    const alTap = capturarGpsAlTap(() => fixDe(-31, TAP_MS - GPS_FIX_MAX_AGE_MS - 1));

    expect(mockGetCurrentGpsFix).toHaveBeenCalledTimes(1);
    expect(alTap.resueltoAlTap).toBe(false);
    await expect(alTap.fix).resolves.toBe(fresco);
  });

  it('el watcher se lee al toque: un fix posterior no cambia el punto', async () => {
    let watcher = fixDe(-31, TAP_MS);
    const alTap = capturarGpsAlTap(() => watcher);
    watcher = fixDe(-40, TAP_MS + 10_000);

    await attachGpsCapture('tree-1', alTap);

    expect(mockUpdateTreeGps).toHaveBeenCalledWith('tree-1', expect.objectContaining({ latitude: -31 }));
  });

  it('con la medición desactivada no prende el GPS', async () => {
    mockGetGpsEnabled.mockReturnValue(false);

    const alTap = capturarGpsAlTap(() => null);

    await expect(alTap.fix).resolves.toBeNull();
    expect(alTap.resueltoAlTap).toBe(true);
    expect(mockGetCurrentGpsFix).not.toHaveBeenCalled();
  });
});

describe('attachGpsCapture — gate por medición de GPS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('medición desactivada: no captura, no pide fix fresco, no escribe coordenadas', async () => {
    mockGetGpsEnabled.mockReturnValue(false);

    const result = await attachGpsCapture('tree-1', { tapAtMs: 1000, fix: Promise.resolve(null), resueltoAlTap: true });

    expect(result).toBe(false);
    expect(mockGetCurrentGpsFix).not.toHaveBeenCalled();
    expect(mockUpdateTreeGps).not.toHaveBeenCalled();
  });
});

describe('puntoGpsEnCamino', () => {
  const pendiente = { tapAtMs: TAP_MS, fix: new Promise<null>(() => {}), resueltoAlTap: false };

  it('pendiente y la posición captura: devuelve el punto', () => {
    expect(puntoGpsEnCamino(pendiente, 11, 10)).toBe(pendiente.fix);
  });

  it('resuelto al toque: nada que avisar', () => {
    expect(puntoGpsEnCamino({ ...pendiente, resueltoAlTap: true }, 1, 1)).toBeUndefined();
  });

  it('la posición no captura GPS: nada que avisar', () => {
    expect(puntoGpsEnCamino(pendiente, 2, 10)).toBeUndefined();
  });
});
