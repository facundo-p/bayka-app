import { ENCUADRE_MAPA, planificarMapa } from '../planMapa';

const PUNTOS = [
  { lat: -27.3601, lng: -55.8974, color: '#0a3760' },
  { lat: -27.3605, lng: -55.8969, color: '#99b95b' },
];

test('sin nada que ubicar no hay plan', () => {
  expect(planificarMapa({ puntos: [], ancho: 128, alto: 128 })).toBeNull();
});

test('ubica puntos, resaltado y etiquetas dentro del mapa, con su color y texto', () => {
  const plan = planificarMapa({
    puntos: PUNTOS,
    resaltado: { lat: -27.3603, lng: -55.8972, color: '#e0a83b' },
    etiquetas: [{ lat: -27.3602, lng: -55.8971, texto: 'LP12' }],
    ancho: 128,
    alto: 128,
  });
  expect(plan?.puntos.map((punto) => punto.color)).toEqual(['#0a3760', '#99b95b']);
  expect(plan?.resaltado?.color).toBe('#e0a83b');
  expect(plan?.etiquetas[0].texto).toBe('LP12');
  const todos = [...(plan?.puntos ?? []), plan?.resaltado, ...(plan?.etiquetas ?? [])];
  for (const ubicado of todos) {
    expect(ubicado?.x).toBeGreaterThanOrEqual(ENCUADRE_MAPA.margenPt - 1e-9);
    expect(ubicado?.x).toBeLessThanOrEqual(128 - ENCUADRE_MAPA.margenPt + 1e-9);
  }
});

test('solo el resaltado alcanza para encuadrar', () => {
  const plan = planificarMapa({ puntos: [], resaltado: PUNTOS[0], ancho: 128, alto: 128 });
  expect(plan?.resaltado?.x).toBeCloseTo(64, 6);
  expect(plan?.escala.texto).toBe('20 m');
});
