import type { Medidor } from '../medirTexto';
import { renglonador } from '../renglonador';

const modo = vi.hoisted(() => ({ cortar: false }));
vi.mock('../textoLargo', () => ({
  get CORTAR_TEXTO_LARGO() {
    return modo.cortar;
  },
}));

const porUnidad: Medidor = (texto) => texto.length;

test('con el texto entero, lo parte en los renglones que haga falta', () => {
  modo.cortar = false;
  const renglones = renglonador(porUnidad);
  expect(renglones('Loma de los Paraísos', 11.5)).toEqual(['Loma de los', 'Paraísos']);
  expect(renglones('Loma de los Paraísos', 11.5, 4.5)).toEqual(['Loma', 'de los', 'Paraísos']);
});

test('con el texto cortado, lo deja en un renglón con «…», al ancho del primero', () => {
  modo.cortar = true;
  const renglones = renglonador(porUnidad);
  expect(renglones('Loma de los Paraísos', 11.5)).toEqual(['Loma de lo…']);
  expect(renglones('Loma de los Paraísos', 11.5, 4.5)).toEqual(['Lom…']);
});

test.each([false, true])('lo que entra sale igual (cortar: %s)', (cortar) => {
  modo.cortar = cortar;
  expect(renglonador(porUnidad)('Loma', 11.5)).toEqual(['Loma']);
});
