import { pesoDeFotos, rotuloIncluirFotos } from '../../src/utils/pesoDeFotosDelCatalogo';

const MB = 1024 * 1024;

const plantacion = (id: string, photo_count: number | null, photo_bytes: number | null) => ({
  id,
  photo_count,
  photo_bytes,
});

describe('pesoDeFotos (#685)', () => {
  it('muestra el peso de una plantación con fotos', () => {
    expect(pesoDeFotos(plantacion('a', 12, 41 * MB))).toBe('41 MB');
  });

  it('sin fotos no muestra nada, ni "0 KB"', () => {
    expect(pesoDeFotos(plantacion('a', 0, 0))).toBeNull();
  });

  it('con un server sin el dato no muestra nada', () => {
    expect(pesoDeFotos(plantacion('a', null, null))).toBeNull();
  });
});

describe('rotuloIncluirFotos (#685)', () => {
  const catalogo = [
    plantacion('a', 100, 100 * MB),
    plantacion('b', 20, 28 * MB),
    plantacion('c', 0, 0),
    plantacion('d', null, null),
  ];

  it('suma el peso de las seleccionadas', () => {
    expect(rotuloIncluirFotos(catalogo, new Set(['a', 'b']))).toBe('Incluir fotos · 128 MB');
  });

  it('sin selección no agrega el peso', () => {
    expect(rotuloIncluirFotos(catalogo, new Set())).toBe('Incluir fotos');
  });

  it('si lo seleccionado no tiene fotos no agrega "0 KB"', () => {
    expect(rotuloIncluirFotos(catalogo, new Set(['c']))).toBe('Incluir fotos');
  });

  it('una plantación sin el dato no suma ni borra el total del resto', () => {
    expect(rotuloIncluirFotos(catalogo, new Set(['b', 'd']))).toBe('Incluir fotos · 28 MB');
    expect(rotuloIncluirFotos(catalogo, new Set(['d']))).toBe('Incluir fotos');
  });

  it('ignora ids seleccionados que ya no están en el catálogo', () => {
    expect(rotuloIncluirFotos(catalogo, new Set(['b', 'z']))).toBe('Incluir fotos · 28 MB');
  });
});
