import { SIN_ESPECIE_CIENTIFICA } from '../../../services/especieValidaciones';
import { opcionesDeEspecieCientifica } from '../opcionesCientificas';

const CIENTIFICAS = [
  {
    id: 'ec-1',
    nombre: 'Prosopis alba',
    especies: [
      { id: 'sp-1', codigo: 'ALB', nombre: 'Algarrobo blanco' },
      { id: 'sp-2', codigo: 'IGA', nombre: 'Igarobá' },
    ],
  },
  { id: 'ec-2', nombre: 'Celtis tala', especies: [] },
];

test('la primera opción desvincula y cada especie científica dice qué agrupa', () => {
  expect(opcionesDeEspecieCientifica(CIENTIFICAS, null)).toEqual([
    { valor: SIN_ESPECIE_CIENTIFICA, principal: 'Sin especie científica' },
    { valor: 'ec-1', principal: 'Prosopis alba', secundario: 'Agrupa Algarrobo blanco, Igarobá' },
    { valor: 'ec-2', principal: 'Celtis tala', secundario: null },
  ]);
});

test('la especie que se edita no cuenta entre las que agrupa', () => {
  const [, prosopis] = opcionesDeEspecieCientifica(CIENTIFICAS, 'sp-1');
  expect(prosopis.secundario).toBe('Agrupa Igarobá');
});
