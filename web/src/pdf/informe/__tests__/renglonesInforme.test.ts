import { entradaInforme } from '../../../test/informePdf';
import type { Medidor } from '../../plantilla/medirTexto';
import { ANCHO_TEXTO_INFORME } from '../../plantilla/tokens';
import { datosInforme, type ModeloInforme } from '../datosInforme';
import { informeEnRenglones, type MedidoresInforme } from '../renglonesInforme';

const modo = vi.hoisted(() => ({ cortar: false }));
vi.mock('../../plantilla/textoLargo', () => ({
  get CORTAR_TEXTO_LARGO() {
    return modo.cortar;
  },
}));

// Cada letra mide distinto: un texto medido con la de otro no da el renglón justo.
const porCaracter =
  (puntos: number): Medidor =>
  (texto) =>
    [...texto].length * puntos;

const MEDIDORES: MedidoresInforme = {
  linea: porCaracter(5),
  fila: porCaracter(4),
};

const LARGO = datosInforme(
  entradaInforme({ parcelas: 2, especies: 3, nn: 2, largos: true, codigosLargos: true }),
);
const CORTO = datosInforme(entradaInforme({ parcelas: 2, especies: 3, nn: 2 }));

/** Cada texto que se parte, con la letra y el ancho de su caja. */
function textosDe(modelo: ModeloInforme) {
  const { linea, especie } = ANCHO_TEXTO_INFORME;
  return [
    { texto: modelo.linea, medir: MEDIDORES.linea, ancho: linea },
    ...modelo.especies.filas.map(({ titulo }) => ({
      texto: titulo,
      medir: MEDIDORES.fila,
      ancho: especie,
    })),
  ];
}

/** Los mismos textos, ya en renglones, en el mismo orden. */
const renglonesDe = (modelo: ReturnType<typeof informeEnRenglones>) => [
  modelo.linea,
  ...modelo.especies.filas.map(({ titulo }) => titulo),
];

test('con el texto entero, cada uno se parte a su ancho y junto rearma el original', () => {
  modo.cortar = false;
  const partidos = renglonesDe(informeEnRenglones(LARGO, MEDIDORES));
  textosDe(LARGO).forEach(({ texto, medir, ancho }, indice) => {
    const renglones = partidos[indice];
    const separador = texto.includes(' ') ? ' ' : '';
    expect(renglones.join(separador)).toBe(texto);
    for (const renglon of renglones) expect(medir(renglon)).toBeLessThan(ancho);
  });
  // La línea y el nombre de la primera especie.
  for (const indice of [0, 1]) expect(partidos[indice].length).toBeGreaterThan(1);
});

test('con el texto cortado, cada uno va en un renglón con «…», a su ancho', () => {
  modo.cortar = true;
  const cortados = renglonesDe(informeEnRenglones(LARGO, MEDIDORES));
  textosDe(LARGO).forEach(({ texto, medir, ancho }, indice) => {
    const [cortado, ...demas] = cortados[indice];
    expect(demas).toEqual([]);
    if (medir(texto) < ancho) return expect(cortado).toBe(texto);
    expect(cortado.endsWith('…')).toBe(true);
    expect(medir(cortado)).toBeLessThan(ancho);
  });
});

describe.each([false, true])('cortar: %s', (cortar) => {
  beforeEach(() => {
    modo.cortar = cortar;
  });

  test('lo que entra va igual, en un renglón, y lo demás del modelo no cambia', () => {
    const enRenglones = informeEnRenglones(CORTO, MEDIDORES);
    expect(enRenglones).toEqual({
      ...CORTO,
      linea: [CORTO.linea],
      especies: {
        ...CORTO.especies,
        filas: CORTO.especies.filas.map((fila) => ({ ...fila, titulo: [fila.titulo] })),
      },
    });
  });

  test('sin el mapa elegido sigue sin mapa', () => {
    const sinMapa = { ...CORTO, mapa: null };
    expect(informeEnRenglones(sinMapa, MEDIDORES).mapa).toBeNull();
  });
});
