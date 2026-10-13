import {
  dibujableEnTodas,
  saneadorDeTexto,
  sanearTextos,
  type Dibujable,
  type FuenteConGlifos,
} from '../sanearTextos';

/** Una fuente que tiene solo estos caracteres. */
const fuenteCon = (caracteres: string): FuenteConGlifos => {
  const codigos = new Set(Array.from(caracteres, (caracter) => caracter.codePointAt(0)));
  return { hasGlyphForCodePoint: (codigo) => codigos.has(codigo) };
};

const ASCII_IMPRIMIBLE = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCharCode(0x20 + i),
).join('');

// Dos letras con su respaldo: «ñ» la tienen las dos, «ĩ» solo la primera y «Š» solo el respaldo.
const COMUNES = `${ASCII_IMPRIMIBLE}ÍíÑñ`;
const RESPALDO = fuenteCon(`${ASCII_IMPRIMIBLE}Š`);
const PILAS = [
  [fuenteCon(`${COMUNES}ĩ`), RESPALDO],
  [fuenteCon(COMUNES), RESPALDO],
];
const sanear = saneadorDeTexto(dibujableEnTodas(PILAS));

describe('cada texto', () => {
  test('los saltos de línea, tabs y demás controles pasan a un espacio, y las rachas a uno', () => {
    expect(sanear('Línea\n10')).toBe('Línea 10');
    expect(sanear('Línea\r\n\t10')).toBe('Línea 10');
    expect(sanear('Línea  10')).toBe('Línea 10');
    expect(sanear('Línea\u000010\u007f')).toBe('Línea 10 ');
    expect(sanear('Línea  　10')).toBe('Línea 10');
  });

  test('se compone en NFC antes de buscar el glifo', () => {
    expect(sanear('ñandu')).toBe('ñandu');
  });

  test('un punto de código que alguna pila no puede dibujar sale «?»', () => {
    expect(sanear('ñ')).toBe('ñ');
    expect(sanear('Š')).toBe('Š');
    expect(sanear('Guasu ĩ')).toBe('Guasu ?');
    expect(sanear('ĩ')).toBe('?');
    expect(sanear('Σ 中文')).toBe('? ??');
  });

  test('un emoji es un punto de código: un «?»', () => {
    expect(sanear('Yerba 😀')).toBe('Yerba ?');
  });

  test('el ASCII imprimible sale igual, sin preguntarle a las fuentes', () => {
    const dibujable = vi.fn<Dibujable>(() => false);
    expect(saneadorDeTexto(dibujable)(ASCII_IMPRIMIBLE)).toBe(ASCII_IMPRIMIBLE);
    expect(dibujable).not.toHaveBeenCalled();
  });

  test('cada texto y cada punto de código se resuelven una sola vez', () => {
    const hasGlyphForCodePoint = vi.fn(() => true);
    const sanearUno = saneadorDeTexto(dibujableEnTodas([[{ hasGlyphForCodePoint }]]));
    for (let fila = 0; fila < 7000; fila++) sanearUno('Ñu Ñu');
    expect(hasGlyphForCodePoint).toHaveBeenCalledTimes(3);
  });
});

describe('el modelo entero', () => {
  test('sanea cada string de objetos y arrays anidados', () => {
    const modelo = { titulo: 'Ñu\nGuasu', filas: [{ nombre: 'ĩ', cantidad: 3 }], vacio: null };
    expect(sanearTextos(modelo, sanear)).toEqual({
      titulo: 'Ñu Guasu',
      filas: [{ nombre: '?', cantidad: 3 }],
      vacio: null,
    });
    expect(sanearTextos(['Σ', true, 2], sanear)).toEqual(['?', true, 2]);
  });

  test('deja tal cual lo que no es un objeto plano ni un array', () => {
    const intactos = [new Blob(['Σ']), new ArrayBuffer(2), new Uint8Array(2), new Date(0)];
    const saneados = sanearTextos({ intactos }, sanear).intactos;
    intactos.forEach((intacto, indice) => expect(saneados[indice]).toBe(intacto));
  });

  test('lo compartido sigue compartido', () => {
    const especie = { nombre: 'Σ' };
    const { tarjeta, fila } = sanearTextos({ tarjeta: { especie }, fila: { especie } }, sanear);
    expect(tarjeta.especie).toBe(fila.especie);
    expect(tarjeta.especie.nombre).toBe('?');
  });
});
