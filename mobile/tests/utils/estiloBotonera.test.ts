// Lógica pura del tamaño y orden de la botonera (#744).
import {
  esEstiloOriginal,
  especiesDeMuestra,
  leerEstiloBotonera,
  limitarTamano,
  textosDelBoton,
} from '../../src/utils/estiloBotonera';

const ORIGINAL = { orden: 'codigo-arriba', tamanoCodigo: 18, tamanoNombre: 11 } as const;

describe('leerEstiloBotonera', () => {
  it('lee un estilo válido', () => {
    const guardado = { orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 };
    expect(leerEstiloBotonera(JSON.stringify(guardado))).toEqual(guardado);
  });

  it.each(['', '{roto', 'null', '42', '"texto"'])('con %p vuelve al original', (guardado) => {
    expect(leerEstiloBotonera(guardado)).toEqual(ORIGINAL);
  });

  it('completa con el original lo que falta o no se entiende', () => {
    expect(leerEstiloBotonera(JSON.stringify({ orden: 'al-costado', tamanoCodigo: 'grande' }))).toEqual(ORIGINAL);
    expect(leerEstiloBotonera(JSON.stringify({ tamanoNombre: 14 }))).toEqual({ ...ORIGINAL, tamanoNombre: 14 });
  });

  it('lleva al rango los tamaños guardados fuera de él', () => {
    expect(leerEstiloBotonera(JSON.stringify({ ...ORIGINAL, tamanoCodigo: 99, tamanoNombre: 2 })))
      .toEqual({ ...ORIGINAL, tamanoCodigo: 24, tamanoNombre: 9 });
  });
});

describe('limitarTamano', () => {
  it.each([[8, 9], [9, 9], [16, 16], [24, 24], [25, 24], [12.6, 13]])('%p → %p', (entrada, esperado) => {
    expect(limitarTamano(entrada)).toBe(esperado);
  });
});

describe('esEstiloOriginal', () => {
  it('distingue el original de cualquier cambio', () => {
    expect(esEstiloOriginal({ ...ORIGINAL })).toBe(true);
    expect(esEstiloOriginal({ ...ORIGINAL, orden: 'nombre-arriba' })).toBe(false);
    expect(esEstiloOriginal({ ...ORIGINAL, tamanoNombre: 12 })).toBe(false);
  });
});

describe('textosDelBoton', () => {
  it('con código arriba, el código va primero con su tamaño', () => {
    expect(textosDelBoton({ ...ORIGINAL }, 'LAP', 'Lapacho')).toEqual([
      { texto: 'LAP', tamano: 18 },
      { texto: 'Lapacho', tamano: 11 },
    ]);
  });

  it('con nombre arriba, el nombre va primero y cada uno conserva su tamaño', () => {
    expect(textosDelBoton({ orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 }, 'LAP', 'Lapacho')).toEqual([
      { texto: 'Lapacho', tamano: 16 },
      { texto: 'LAP', tamano: 12 },
    ]);
  });
});

describe('especiesDeMuestra', () => {
  const especie = (nombre: string) => ({ nombre });

  it('elige la de nombre más corto y la de nombre más largo', () => {
    const especies = [especie('Lapacho rosado'), especie('Timbó'), especie('Cedro misionero'), especie('Anchico')];
    expect(especiesDeMuestra(especies)).toEqual([especie('Timbó'), especie('Cedro misionero')]);
  });

  it('con empate de largo, se queda con la primera de la botonera', () => {
    expect(especiesDeMuestra([especie('Timbó'), especie('Ceibo'), especie('Urunday')])).toEqual([
      especie('Timbó'),
      especie('Urunday'),
    ]);
  });

  it('con menos de dos especies devuelve las que hay', () => {
    expect(especiesDeMuestra([especie('Timbó')])).toEqual([especie('Timbó')]);
    expect(especiesDeMuestra([])).toEqual([]);
  });
});
