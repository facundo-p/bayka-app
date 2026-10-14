import { distanciaMetros } from './distancia';

const SAN_SEBASTIAN = { lat: -27.36012, lng: -55.89744 };

test('un grado de latitud son ~111 km y el mismo punto, cero', () => {
  const unGradoAlSur = { lat: SAN_SEBASTIAN.lat - 1, lng: SAN_SEBASTIAN.lng };
  expect(distanciaMetros(SAN_SEBASTIAN, unGradoAlSur)).toBeCloseTo(111_319, -1);
  expect(distanciaMetros(SAN_SEBASTIAN, SAN_SEBASTIAN)).toBe(0);
});
