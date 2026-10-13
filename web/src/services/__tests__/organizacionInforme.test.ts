import { leerNombreOrganizacion } from '../../queries/fichasQueries';
import { leerOrganizacionDelInforme } from '../organizacionInforme';

vi.mock('../../queries/fichasQueries', () => ({ leerNombreOrganizacion: vi.fn() }));

test('lee la organización de la plantación', async () => {
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  expect(await leerOrganizacionDelInforme('p1')).toBe('Bayka');
  expect(leerNombreOrganizacion).toHaveBeenCalledWith('p1');
});

test('si no se puede leer, null: el informe sale igual', async () => {
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  expect(await leerOrganizacionDelInforme('p1')).toBeNull();
});
