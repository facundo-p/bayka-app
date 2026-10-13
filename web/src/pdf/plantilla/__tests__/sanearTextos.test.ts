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
    expect(sanear('Línea\u00a0\u202f\u300010')).toBe('Línea 10');
  });

  test('los invisibles se quitan', () => {
    expect(sanear('\u00ad')).toBe('');
    expect(sanear('Parcela\u200b10')).toBe('Parcela10');
    expect(sanear('\ufeffNorte')).toBe('Norte');
    expect(sanear('\u200eNorte\u200f')).toBe('Norte');
  });

  test('se compone en NFC antes de buscar el glifo', () => {
    expect(sanear('n\u0303andu')).toBe('ñandu');
  });

  test('lo que dibujan todas las pilas sale igual', () => {
    expect(sanear('ñ')).toBe('ñ');
    expect(sanear('Š')).toBe('Š');
  });

  test('lo que alguna pila no dibuja queda en su letra base, sin las marcas', () => {
    expect(sanear('Guas\u0169 \u0129')).toBe('Guasu i');
    expect(sanear('i\u0303')).toBe('i');
  });

  test('una marca combinante suelta que no se dibuja se quita', () => {
    expect(sanear('g\u0303uaraní')).toBe('guaraní');
  });

  test('sin letra base que se dibuje, sale «?»', () => {
    expect(sanear('Σ 中文')).toBe('? ??');
    expect(sanear('\u03ac')).toBe('?');
  });

  test('un emoji sale «?», y su selector de variante se quita', () => {
    expect(sanear('Yerba 😀')).toBe('Yerba ?');
    expect(sanear('Yerba \u2764\ufe0f')).toBe('Yerba ?');
    expect(sanear('\ud83d\udc68\u200d\ud83d\udc69')).toBe('??');
  });

  test('el ASCII imprimible sale igual, sin preguntarle a las fuentes', () => {
    const dibujable = vi.fn<Dibujable>(() => false);
    expect(saneadorDeTexto(dibujable)(ASCII_IMPRIMIBLE)).toBe(ASCII_IMPRIMIBLE);
    expect(dibujable).not.toHaveBeenCalled();
  });

  test('cada texto se sanea una sola vez', () => {
    const dibujable = vi.fn<Dibujable>(() => true);
    const sanearUno = saneadorDeTexto(dibujable);
    for (let fila = 0; fila < 7000; fila++) sanearUno('Ñu Ñu');
    expect(dibujable).toHaveBeenCalledTimes(5);
  });

  test('a las fuentes se les pregunta una sola vez por punto de código', () => {
    const hasGlyphForCodePoint = vi.fn(() => true);
    const dibujable = dibujableEnTodas([[{ hasGlyphForCodePoint }]]);
    Array.from('Ñu Ñu', (caracter) => dibujable(caracter.codePointAt(0)!));
    expect(hasGlyphForCodePoint).toHaveBeenCalledTimes(3);
  });
});

describe('el modelo entero', () => {
  test('sanea cada string de objetos y arrays anidados', () => {
    const modelo = { titulo: 'Ñu\nGuasu', filas: [{ nombre: 'Σ', cantidad: 3 }], vacio: null };
    expect(sanearTextos(modelo, sanear)).toEqual({
      titulo: 'Ñu Guasu',
      filas: [{ nombre: '?', cantidad: 3 }],
      vacio: null,
    });
    expect(sanearTextos(['Σ', true, 2], sanear)).toEqual(['?', true, 2]);
  });

  test('las URL de las imágenes salen iguales', () => {
    const modelo = {
      logo: 'https://staging.bayka-app.pages.dev/logo-bayka.png',
      foto: { src: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ+/=' },
    };
    const saneado = sanearTextos(modelo, sanear);
    expect(saneado.logo).toBe(modelo.logo);
    expect(saneado.foto.src).toBe(modelo.foto.src);
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
