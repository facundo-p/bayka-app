import { numerarPorIdParcial, type ArbolNumerable } from './idParcial';

const arbol = (
  arbolId: string,
  grupoId: string,
  grupoCreadoEn: string,
  posicion: number,
): ArbolNumerable => ({ arbolId, grupoId, grupoCreadoEn, posicion });

const ids = (arboles: ArbolNumerable[]) =>
  numerarPorIdParcial(arboles).map(({ arbolId, idParcial }) => [arbolId, idParcial]);

describe('numerarPorIdParcial', () => {
  it('numera desde 1 por alta del grupo y después por posición', () => {
    const arboles = [
      arbol('b2', 'g-b', '2026-03-02T10:00:00Z', 2),
      arbol('a2', 'g-a', '2026-03-01T10:00:00Z', 2),
      arbol('b1', 'g-b', '2026-03-02T10:00:00Z', 1),
      arbol('a1', 'g-a', '2026-03-01T10:00:00Z', 1),
    ];
    expect(ids(arboles)).toEqual([
      ['a1', 1],
      ['a2', 2],
      ['b1', 3],
      ['b2', 4],
    ]);
  });

  it('ordena por posición numérica, no por texto', () => {
    const arboles = [
      arbol('t10', 'g', '2026-03-01T10:00:00Z', 10),
      arbol('t9', 'g', '2026-03-01T10:00:00Z', 9),
    ];
    expect(ids(arboles)).toEqual([
      ['t9', 1],
      ['t10', 2],
    ]);
  });

  it('compara las altas como instantes, aunque vengan con otro formato u offset', () => {
    // 09:30Z es antes que 07:00-03:00 (10:00Z), aunque como texto vaya después.
    const arboles = [
      arbol('del-server', 'g-1', '2026-03-01T07:00:00-03:00', 1),
      arbol('del-telefono', 'g-2', '2026-03-01T09:30:00.000Z', 1),
    ];
    expect(ids(arboles)).toEqual([
      ['del-telefono', 1],
      ['del-server', 2],
    ]);
  });

  it('distingue altas por microsegundos, como Postgres', () => {
    const arboles = [
      arbol('despues', 'g-a', '2026-03-01T10:00:00.123457+00:00', 1),
      arbol('antes', 'g-b', '2026-03-01T10:00:00.123456+00:00', 1),
    ];
    expect(ids(arboles)).toEqual([
      ['antes', 1],
      ['despues', 2],
    ]);
  });

  it('con la misma alta desempata por id del grupo, sin importar el orden de entrada', () => {
    const arboles = [
      arbol('de-g2', '22222222-0000-0000-0000-000000000000', '2026-03-01T10:00:00Z', 1),
      arbol('de-g1', '11111111-0000-0000-0000-000000000000', '2026-03-01T10:00:00Z', 1),
    ];
    expect(ids(arboles)).toEqual(ids([...arboles].reverse()));
    expect(ids(arboles)).toEqual([
      ['de-g1', 1],
      ['de-g2', 2],
    ]);
  });

  it('un alta ilegible va al final', () => {
    const arboles = [
      arbol('sin-fecha', 'g-a', 'no es fecha', 1),
      arbol('con-fecha', 'g-b', '2026-03-01T10:00:00Z', 5),
    ];
    expect(ids(arboles)).toEqual([
      ['con-fecha', 1],
      ['sin-fecha', 2],
    ]);
  });

  it('no modifica la lista que recibe y conserva el resto de los campos', () => {
    const arboles = [
      { ...arbol('b', 'g', '2026-03-01T10:00:00Z', 2), especie: 'Roble' },
      { ...arbol('a', 'g', '2026-03-01T10:00:00Z', 1), especie: 'Pino' },
    ];
    const numerados = numerarPorIdParcial(arboles);
    expect(arboles.map((a) => a.arbolId)).toEqual(['b', 'a']);
    expect(numerados[0]).toMatchObject({ arbolId: 'a', especie: 'Pino', idParcial: 1 });
  });

  it('sin árboles devuelve una lista vacía', () => {
    expect(numerarPorIdParcial([])).toEqual([]);
  });
});
