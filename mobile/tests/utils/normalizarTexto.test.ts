import { coincideBusqueda, sinAcentos } from '../../src/utils/normalizarTexto';
import { filtrarEspecies } from '../../src/hooks/useCambioDeEspecie';

describe('sinAcentos', () => {
  it('saca tildes y diéresis', () => {
    expect(sinAcentos('Álamo pingüino ñandú')).toBe('Alamo pinguino nandu');
  });
});

describe('coincideBusqueda', () => {
  it('sin distinguir mayúsculas ni tildes', () => {
    expect(coincideBusqueda(['Álamo'], 'ALA')).toBe(true);
    expect(coincideBusqueda(['Alamo'], 'álamo')).toBe(true);
  });

  it('búsqueda vacía o de espacios coincide con todo', () => {
    expect(coincideBusqueda(['x'], '')).toBe(true);
    expect(coincideBusqueda(['x'], '   ')).toBe(true);
  });

  it('ignora textos nulos', () => {
    expect(coincideBusqueda([null, undefined, 'Tala'], 'tal')).toBe(true);
    expect(coincideBusqueda([null], 'tal')).toBe(false);
  });
});

describe('filtrarEspecies', () => {
  const especies = [
    { nombre: 'Ceibo', nombreCientifico: 'Erythrina crista-galli' },
    { nombre: 'Tala', nombreCientifico: 'Celtis tala' },
    { nombre: 'Sin nombre científico', nombreCientifico: null },
  ];

  it('por nombre común', () => {
    expect(filtrarEspecies(especies, 'cei').map((e) => e.nombre)).toEqual(['Ceibo']);
  });

  it('por nombre científico', () => {
    expect(filtrarEspecies(especies, 'erythrina').map((e) => e.nombre)).toEqual(['Ceibo']);
  });

  it('vacía devuelve todas', () => {
    expect(filtrarEspecies(especies, '')).toHaveLength(3);
  });
});
