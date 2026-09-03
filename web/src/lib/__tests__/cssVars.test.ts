import { varsCss } from '../cssVars';

test('antepone -- a cada clave y castea valores a string', () => {
  expect(varsCss({ ancho: '40%', color: '#ff0000' })).toEqual({
    '--ancho': '40%',
    '--color': '#ff0000',
  });
});

test('convierte números a string', () => {
  expect(varsCss({ opacidad: 0.5 })).toEqual({ '--opacidad': '0.5' });
});

test('objeto vacío da estilo vacío', () => {
  expect(varsCss({})).toEqual({});
});
