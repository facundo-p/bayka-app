// @vitest-environment node
import { MEDIDA_FICHA } from '../../plantilla/tokens';
import { tamanoIdArbol } from '../Ficha.styles';

/** IBM Plex Mono: cada glifo mide 0,6 em. */
const ANCHO_GLIFO_EM = 0.6;

const anchoImpreso = (idArbol: string) => idArbol.length * ANCHO_GLIFO_EM * tamanoIdArbol(idArbol);

test('un ID Árbol común va a tamaño pleno', () => {
  expect(tamanoIdArbol('LP12L10ANC23-SS26')).toBe(MEDIDA_FICHA.letra.idArbol);
});

test('uno largo se achica hasta entrar justo en un renglón de la columna', () => {
  const largo = 'LPN12L10ANCH123-SS2026B';
  expect(tamanoIdArbol(largo)).toBeLessThan(MEDIDA_FICHA.letra.idArbol);
  expect(anchoImpreso(largo)).toBeCloseTo(MEDIDA_FICHA.anchoTexto);
});
