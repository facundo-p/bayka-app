import type { PuntoGps } from '../../../queries/mapaQueries';
import { arbolParaFicha, coloresEnOrden } from '../../../test/fabricas';
import { COLOR_GRAFICO_NN } from '../../../theme/chartColors';
import { dibujarMapa } from '../../mapa/dibujarMapa';
import { MEDIDA_FICHA } from '../../plantilla/tokens';
import { contenidoMinimapa, minimapaDeArbol } from '../minimapa';

const PT_POR_PULGADA = 72;

// jsdom no tiene canvas: el dibujo se prueba en el navegador.
vi.mock('../../mapa/dibujarMapa', () => ({ dibujarMapa: vi.fn() }));

function punto(sobre: Partial<PuntoGps>): PuntoGps {
  return {
    lat: -27.36,
    lng: -55.89,
    codigo: 'ANC',
    nombre: 'Anchico',
    idArbol: 'X-SS26',
    subId: 'X',
    parcelaId: 'parc-1',
    ...sobre,
  };
}

const COLOR_DE = coloresEnOrden('ANC', 'LAP');

const ARBOL = arbolParaFicha({
  idArbol: 'A-001-SS26',
  parcelaId: 'parc-1',
  gps: { lat: -27.361, lng: -55.891, precision: 3 },
});

test('sin GPS no hay minimapa', () => {
  expect(contenidoMinimapa({ ...ARBOL, gps: null }, [punto({})], COLOR_DE)).toBeNull();
});

test('toda la parcela del árbol, sin otras parcelas ni el árbol repetido', () => {
  const puntos = [
    punto({ idArbol: 'B-SS26', codigo: 'LAP' }),
    punto({ idArbol: 'C-SS26', codigo: 'NN' }),
    punto({ idArbol: 'D-SS26', parcelaId: 'parc-2' }),
    punto({ idArbol: 'A-001-SS26', lat: -27.361, lng: -55.891 }),
  ];
  const contenido = contenidoMinimapa(ARBOL, puntos, COLOR_DE);
  expect(contenido?.puntos.map((vecino) => vecino.color)).toEqual([
    COLOR_DE('LAP'),
    COLOR_GRAFICO_NN,
  ]);
  expect(contenido?.resaltado).toEqual({
    lat: -27.361,
    lng: -55.891,
    color: COLOR_GRAFICO_NN,
  });
});

test('sin parcela no suma vecinos de toda la plantación', () => {
  const sinParcela = { ...ARBOL, parcelaId: null };
  const contenido = contenidoMinimapa(sinParcela, [punto({ parcelaId: null })], COLOR_DE);
  expect(contenido?.puntos).toEqual([]);
  expect(contenido?.resaltado).toBeDefined();
});

test('un vecino a más de 2 km es un GPS errado y no entra al encuadre', () => {
  const puntos = [
    punto({ idArbol: 'B-SS26' }),
    punto({ idArbol: 'CERO-SS26', lat: 0, lng: 0 }),
    // Un dígito de más en la latitud: ~2,7 km al sur.
    punto({ idArbol: 'TYPO-SS26', lat: -27.385, lng: -55.891 }),
  ];
  expect(contenidoMinimapa(ARBOL, puntos, COLOR_DE)?.puntos).toHaveLength(1);
});

test('si el canvas falla, el mapa queda no disponible en vez de cortar la ficha', async () => {
  vi.mocked(dibujarMapa).mockRejectedValueOnce(new Error('canvas'));
  await expect(minimapaDeArbol(ARBOL, [], COLOR_DE)).resolves.toEqual({ estado: 'no-disponible' });
});

test('con el mapa dibujado sobre el satélite, la ficha lo muestra con satélite', async () => {
  vi.mocked(dibujarMapa).mockResolvedValueOnce({ src: 'data:image/jpeg;base64,M', conFondo: true });
  await expect(minimapaDeArbol(ARBOL, [], COLOR_DE)).resolves.toEqual({
    estado: 'listo',
    src: 'data:image/jpeg;base64,M',
    conSatelite: true,
  });
  expect(vi.mocked(dibujarMapa).mock.lastCall?.[0].fondo).toEqual(expect.any(Function));
});

test('si el satélite no se pudo bajar, el mapa sale liso y sin satélite', async () => {
  vi.mocked(dibujarMapa).mockResolvedValueOnce({ src: 'data:image/png;base64,M', conFondo: false });
  await expect(minimapaDeArbol(ARBOL, [], COLOR_DE)).resolves.toEqual({
    estado: 'listo',
    src: 'data:image/png;base64,M',
    conSatelite: false,
  });
});

test('sin GPS ni se intenta dibujar', async () => {
  vi.mocked(dibujarMapa).mockClear();
  await expect(minimapaDeArbol({ ...ARBOL, gps: null }, [], COLOR_DE)).resolves.toEqual({
    estado: 'sin-gps',
  });
  expect(dibujarMapa).not.toHaveBeenCalled();
});

/** Una hilera de árboles al este del de la ficha, a ~2 m uno de otro. */
function hilera(cantidad: number): PuntoGps[] {
  return Array.from({ length: cantidad }, (_, indice) =>
    punto({ idArbol: `H${indice}-SS26`, lat: -27.361, lng: -55.891 + (indice + 1) * 0.00002 }),
  );
}

async function opcionesDeDibujo(puntos: PuntoGps[]) {
  vi.mocked(dibujarMapa).mockResolvedValueOnce(null);
  await minimapaDeArbol(ARBOL, puntos, COLOR_DE);
  return vi.mocked(dibujarMapa).mock.lastCall![0];
}

test('impreso en la caja de la ficha, el minimapa sale cuadrado y a 250 ppp o más', async () => {
  const { ancho, alto, escalaRender } = await opcionesDeDibujo([]);
  expect(alto).toBe(ancho);
  const pulgadasImpresas = MEDIDA_FICHA.ladoImagen / PT_POR_PULGADA;
  expect((ancho * escalaRender!) / pulgadasImpresas).toBeGreaterThanOrEqual(250);
});

test('con muchos árboles a lo ancho los puntos se achican y dejan ver el satélite', async () => {
  const pocos = await opcionesDeDibujo(hilera(5));
  const muchos = await opcionesDeDibujo(hilera(80));
  expect(muchos.radioPunto).toBeLessThan(pocos.radioPunto!);
});
