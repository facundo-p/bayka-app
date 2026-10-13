import { marcoDeMapa, puntoDeEspecie, rotuloEnMayusculas } from '../comunes.styles';
import { ANCHO_TEXTO_INFORME, MEDIDA_INFORME } from '../tokens';

test('el punto es un círculo del diámetro, centrado en el primer renglón y con su aire', () => {
  expect(puntoDeEspecie({ diametro: 7, aire: 4 }, 14)).toEqual({
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 3.5,
    marginRight: 4,
  });
});

test('el rótulo va en mayúsculas espaciadas y apagado, del tamaño que se pide', () => {
  expect(rotuloEnMayusculas(7.2)).toEqual({
    fontSize: 7.2,
    color: '#6e6a5e',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  });
});

test('el marco del mapa es fino y redondeado', () => {
  expect(marcoDeMapa).toEqual({ borderRadius: 3, borderWidth: 0.5, borderColor: '#e7e1d4' });
});

test('el nombre de la especie en el informe tiene el ancho de su columna menos el punto', () => {
  expect(ANCHO_TEXTO_INFORME.especie).toBe(MEDIDA_INFORME.anchoNombreEspecie - 12);
});
