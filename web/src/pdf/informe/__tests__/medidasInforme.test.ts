// Un texto de un renglón va centrado en el alto de su caja, con el aire que
// sobra arriba y abajo; si el renglón no entrara, ese aire saldría negativo y
// el texto pisaría lo de al lado.
import { ALTO_RENGLON_INFORME as ALTO, MEDIDA_INFORME as M } from '../../plantilla/tokens';

test.each([
  ['la línea bajo el título', ALTO.linea, M.altoLineaTitulo],
  ['una especie', ALTO.fila, M.altoFilaEspecie],
  ['un código de la leyenda', ALTO.leyenda, M.altoRenglonLeyenda],
])('el renglón de %s entra en su alto', (_, renglon, alto) => {
  expect(renglon).toBeLessThanOrEqual(alto);
});
