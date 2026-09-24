import { planDeRenombres, type GrupoLocal, type RemoteGroup } from '../../src/services/sync/renombresDeGrupos';

jest.mock('../../src/database/client', () => ({ db: {} }));

const remoto = (id: string, codigo: string, nombre = codigo): RemoteGroup => ({
  id, plantation_id: 'pl', parcela_id: 'p1', nombre, codigo,
  tipo: 'linea', estado: 'activa', usuario_creador: 'u', created_at: '',
});
const local = (codigo: string, pendingSync = false, nombre = codigo): GrupoLocal =>
  ({ pendingSync, parcelaId: 'p1', codigo, nombre });

describe('planDeRenombres (#626)', () => {
  test('sin cambios no hay nada que adoptar', () => {
    expect(planDeRenombres([remoto('g1', 'L1')], new Map([['g1', local('L1')]]))).toEqual([]);
  });

  test('una rotación adopta los dos códigos remotos', () => {
    const plan = planDeRenombres(
      [remoto('g2', 'L1'), remoto('g1', 'L9')],
      new Map([['g1', local('L1')], ['g2', local('L2')]]),
    );
    expect(plan).toEqual([
      { id: 'g2', parcelaId: 'p1', codigoAnterior: 'L2', codigo: 'L1', nombre: 'L1' },
      { id: 'g1', parcelaId: 'p1', codigoAnterior: 'L1', codigo: 'L9', nombre: 'L9' },
    ]);
  });

  test('un grupo pendiente no se toca', () => {
    expect(planDeRenombres([remoto('g1', 'L7')], new Map([['g1', local('L1', true)]]))).toEqual([]);
  });

  test('si el código remoto lo tiene un grupo pendiente, conserva el local', () => {
    const plan = planDeRenombres(
      [remoto('g1', 'L7')],
      new Map([['g1', local('L1')], ['g2', local('L7', true)]]),
    );
    expect(plan).toEqual([{ id: 'g1', parcelaId: 'p1', codigoAnterior: 'L1', codigo: 'L1', nombre: 'L1' }]);
  });

  test('un cambio solo de nombre también se adopta', () => {
    const plan = planDeRenombres([remoto('g1', 'L1', 'Norte')], new Map([['g1', local('L1', false, 'Sur')]]));
    expect(plan).toEqual([{ id: 'g1', parcelaId: 'p1', codigoAnterior: 'L1', codigo: 'L1', nombre: 'Norte' }]);
  });

  test('si el remoto y el local están ocupados, queda el id', () => {
    // g2 toma L1 (el local de g1), y L7 (el remoto de g1) lo tiene un pendiente.
    const plan = planDeRenombres(
      [remoto('g2', 'L1'), remoto('g1', 'L7')],
      new Map([['g1', local('L1')], ['g2', local('L2')], ['g3', local('L7', true)]]),
    );
    expect(plan[1]).toMatchObject({ id: 'g1', codigo: 'g1', nombre: 'g1' });
  });
});
