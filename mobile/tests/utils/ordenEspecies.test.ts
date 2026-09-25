import { porNombre } from '../../src/utils/ordenEspecies';

it('ordena por nombre sin distinguir acentos ni mayúsculas, como el server (#635)', () => {
  const nombres = ['Zarzamora', 'aromo', 'Ñandubay', 'Álamo', 'nogal', 'Espinillo'].map((nombre) => ({ nombre }));
  expect(porNombre(nombres).map((e) => e.nombre)).toEqual(['Álamo', 'aromo', 'Espinillo', 'nogal', 'Ñandubay', 'Zarzamora']);
});
