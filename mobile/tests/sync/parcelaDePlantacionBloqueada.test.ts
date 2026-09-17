/**
 * Una parcela de una plantación finalizada o archivada la rechaza RLS con 42501, el
 * mismo código que la falta de membresía (#511). El estado local desempata.
 */
import { supabase } from '../../src/supabase/client';
import { getSyncableParcelas, markParcelaSynced } from '../../src/repositories/ParcelaRepository';
import { getPlantationEstadoDeEdicion } from '../../src/queries/adminQueries';
import { uploadSyncableParcelas, motivoDeBloqueo } from '../../src/services/sync/pushService';

jest.mock('../../src/supabase/client', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getUser: jest.fn() }, storage: { from: jest.fn() } },
  isSupabaseConfigured: true,
}));
jest.mock('../../src/database/client', () => ({
  db: { select: jest.fn(), update: jest.fn() },
}));
jest.mock('../../src/database/liveQuery', () => ({
  notifyDataChanged: jest.fn(),
}));
jest.mock('../../src/repositories/ParcelaRepository', () => ({
  getSyncableParcelas: jest.fn(),
  markParcelaSynced: jest.fn(),
}));
jest.mock('../../src/queries/adminQueries', () => ({
  getPlantationEstadoDeEdicion: jest.fn(),
}));

const RLS = { code: '42501', message: 'new row violates row-level security policy for table "parcelas"' };
const DUPLICADO = { code: '23505', details: 'Key (plantation_id, codigo)=(p1, LP1) already exists.', message: 'dup' };
const ACTIVA = { estado: 'activa', archivadaEn: null };
const FINALIZADA = { estado: 'finalizada', archivadaEn: null };
const ARCHIVADA = { estado: 'activa', archivadaEn: '2026-09-17T12:00:00+00:00' };

function servidorResponde(error: unknown) {
  (supabase.from as jest.Mock).mockReturnValue({
    upsert: jest.fn().mockResolvedValue({ data: null, error }),
  });
}

async function subirConPlantacion(plantacion: unknown, error: unknown) {
  (getPlantationEstadoDeEdicion as jest.Mock).mockResolvedValue(plantacion);
  servidorResponde(error);
  const [resultado] = await uploadSyncableParcelas('p1');
  return resultado;
}

describe('motivoDeBloqueo', () => {
  test('archivada gana sobre finalizada, como en el server', () => {
    expect(motivoDeBloqueo({ estado: 'finalizada', archivadaEn: '2026-09-17T12:00:00+00:00' }))
      .toBe('PLANTACION_ARCHIVADA');
  });

  test('finalizada → PLANTACION_FINALIZADA', () => {
    expect(motivoDeBloqueo(FINALIZADA)).toBe('PLANTACION_FINALIZADA');
  });

  test('activa o sin datos locales → sin motivo', () => {
    expect(motivoDeBloqueo(ACTIVA)).toBeNull();
    expect(motivoDeBloqueo(null)).toBeNull();
  });
});

describe('uploadSyncableParcelas — rechazo por RLS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSyncableParcelas as jest.Mock).mockResolvedValue([{ id: 'parcela-1', nombre: 'Lote 1', plantacionId: 'p1' }]);
  });

  test('plantación finalizada → PLANTACION_FINALIZADA, no PERMISSION', async () => {
    const resultado = await subirConPlantacion(FINALIZADA, RLS);
    expect(resultado).toEqual({ success: false, parcelaId: 'parcela-1', nombre: 'Lote 1', error: 'PLANTACION_FINALIZADA' });
    expect(markParcelaSynced).not.toHaveBeenCalled();
  });

  test('plantación archivada → PLANTACION_ARCHIVADA', async () => {
    const resultado = await subirConPlantacion(ARCHIVADA, RLS);
    expect(resultado).toMatchObject({ success: false, error: 'PLANTACION_ARCHIVADA' });
  });

  test('plantación activa → sigue siendo un problema de permisos', async () => {
    const resultado = await subirConPlantacion(ACTIVA, RLS);
    expect(resultado).toMatchObject({ success: false, error: 'PERMISSION', detail: expect.stringContaining('42501') });
  });

  test('plantación que no está local → PERMISSION', async () => {
    const resultado = await subirConPlantacion(null, RLS);
    expect(resultado).toMatchObject({ success: false, error: 'PERMISSION' });
  });

  test('otros errores no se reinterpretan aunque la plantación esté bloqueada', async () => {
    const resultado = await subirConPlantacion(ARCHIVADA, DUPLICADO);
    expect(resultado).toMatchObject({ success: false, error: 'DUPLICATE_CODE' });
  });

  test('sin rechazo no consulta el estado local', async () => {
    const resultado = await subirConPlantacion(ARCHIVADA, null);
    expect(resultado).toMatchObject({ success: true });
    expect(getPlantationEstadoDeEdicion).not.toHaveBeenCalled();
  });
});
