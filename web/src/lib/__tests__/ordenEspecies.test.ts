import { porNombre } from '../ordenEspecies';

test('ordena por nombre sin distinguir acentos ni mayúsculas, como el server (#635)', () => {
  const nombres = ['Zarzamora', 'aromo', 'Ñandubay', 'Álamo', 'nogal', 'Espinillo'].map(
    (nombre) => ({
      nombre,
    }),
  );
  expect(porNombre(nombres).map((especie) => especie.nombre)).toEqual([
    'Álamo',
    'aromo',
    'Espinillo',
    'nogal',
    'Ñandubay',
    'Zarzamora',
  ]);
});
