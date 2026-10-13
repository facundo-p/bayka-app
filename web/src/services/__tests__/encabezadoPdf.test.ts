import { leerNombreOrganizacion } from '../../queries/fichasQueries';
import { leerOrganizacionDelEncabezado } from '../encabezadoPdf';

vi.mock('../../queries/fichasQueries', () => ({ leerNombreOrganizacion: vi.fn() }));

test('lee la organización de la plantación', async () => {
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  expect(await leerOrganizacionDelEncabezado('p1')).toBe('Bayka');
  expect(leerNombreOrganizacion).toHaveBeenCalledWith('p1');
});

test('si no se puede leer, null: el PDF sale igual', async () => {
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  expect(await leerOrganizacionDelEncabezado('p1')).toBeNull();
});
