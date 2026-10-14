import novedadesRaw from '../../../../NOVEDADES.md?raw';
import { entradasVisibles } from '../novedades';
import {
  esEntradaEnPruebas,
  parsearNovedades,
  PLATAFORMAS,
  type EntradaNovedades,
} from '../parsearNovedades';

const itemsDe = (entrada: EntradaNovedades) =>
  [entrada.general, ...PLATAFORMAS.map((plataforma) => entrada[plataforma])].flat();

const SIN_PLATAFORMA = { web: [], app: [] };

// Sobre el archivo real solo se afirma la forma: `/deploy` y `/novedades` le
// agregan entradas arriba y un contenido fijo rompería el CI del próximo release.
describe('NOVEDADES.md real', () => {
  const entradas = parsearNovedades(novedadesRaw);
  const publicadas = entradas.filter((entrada) => !esEntradaEnPruebas(entrada));

  test('parsea al menos una entrada publicada, todas con título', () => {
    expect(publicadas.length).toBeGreaterThan(0);
    expect(entradas.filter((entrada) => entrada.titulo.trim() === '')).toEqual([]);
  });

  // Una línea suelta sin `- ` no es ítem: la pantalla mostraría la versión vacía.
  test('toda entrada publicada tiene al menos un ítem', () => {
    expect(publicadas.filter((entrada) => itemsDe(entrada).length === 0)).toEqual([]);
  });

  test('la sección en pruebas, si está, es una sola y va arriba de todo', () => {
    expect(entradas.slice(1).filter(esEntradaEnPruebas)).toEqual([]);
  });

  // Fuera de `### Web` / `### App` solo va el bullet de "Mejoras internas", sin titular (#918).
  test('todo ítem con titular está bajo una plataforma', () => {
    const sueltos = entradas.flatMap((entrada) => entrada.general).filter((item) => item.titular);

    expect(sueltos).toEqual([]);
  });

  test('fuera de staging no se ve ninguna entrada en pruebas', () => {
    expect(entradasVisibles(entradas, false).filter(esEntradaEnPruebas)).toEqual([]);
  });

  // Los pasos quedan en el archivo para todas las versiones (#580) y solo los ve
  // quien prueba staging (#582).
  test('fuera de staging ningún ítem muestra pasos', () => {
    const items = entradasVisibles(entradas, false).flatMap(itemsDe);

    expect(items.filter((item) => item.pasos)).toEqual([]);
  });
});

describe('parsearNovedades: entradas publicadas', () => {
  const PUBLICADAS = [
    '# Novedades de Bayka',
    '',
    'Intro con **bold** que no es una entrada.',
    '',
    '## Web 1.1.0 · 21 de agosto de 2026',
    '',
    '- **Mostrá u ocultá tu contraseña.** El inicio de sesión y los formularios de',
    '  contraseña ahora tienen un botón con forma de ojo.',
    '',
    '## Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026',
    '',
    '- Primera versión numerada de Bayka: la gestión web para administrar',
    '  plantaciones y la app Android.',
  ].join('\n');
  const entradas = parsearNovedades(PUBLICADAS);
  const [nueva, primera] = entradas;

  test('una entrada por versión, con el título tal cual está escrito', () => {
    expect(entradas.map((entrada) => entrada.titulo)).toEqual([
      'Web 1.1.0 · 21 de agosto de 2026',
      'Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026',
    ]);
  });

  test('el bullet con titular se parte en titular + detalle, uniendo el wrap', () => {
    expect(nueva.general).toEqual([
      {
        titular: 'Mostrá u ocultá tu contraseña.',
        detalle:
          'El inicio de sesión y los formularios de contraseña ahora tienen un botón con forma de ojo.',
      },
    ]);
  });

  test('el bullet sin bold queda como puro detalle', () => {
    expect(primera.general).toEqual([
      {
        detalle:
          'Primera versión numerada de Bayka: la gestión web para administrar plantaciones y la app Android.',
      },
    ]);
  });
});

describe('parsearNovedades: contrato', () => {
  test('ignora todo lo anterior al primer ##, incluido el h1 y los bullets sueltos', () => {
    const crudo = ['# Titulo', '', '- bullet huérfano', '', '## Web 1.0.0', '', '- real'].join(
      '\n',
    );

    expect(parsearNovedades(crudo)).toEqual([
      { titulo: 'Web 1.0.0', general: [{ detalle: 'real' }], ...SIN_PLATAFORMA },
    ]);
  });

  test('una entrada sin bullets se conserva', () => {
    expect(parsearNovedades('## Web 2.0.0')).toEqual([
      { titulo: 'Web 2.0.0', general: [], ...SIN_PLATAFORMA },
    ]);
  });

  test('titular sin detalle deja el detalle vacío', () => {
    expect(parsearNovedades('## X\n\n- **Solo titular.**')).toEqual([
      { titulo: 'X', general: [{ titular: 'Solo titular.', detalle: '' }], ...SIN_PLATAFORMA },
    ]);
  });

  test('bold sin cerrar no rompe: cae entero a detalle', () => {
    expect(parsearNovedades('## X\n\n- **Sin cerrar y sigue')).toEqual([
      { titulo: 'X', general: [{ detalle: '**Sin cerrar y sigue' }], ...SIN_PLATAFORMA },
    ]);
  });

  test('la línea en blanco corta la continuación: no se pega al bullet anterior', () => {
    const crudo = ['## X', '', '- uno', '  sigue uno', '', 'texto suelto', '', '- dos'].join('\n');

    expect(parsearNovedades(crudo)).toEqual([
      {
        titulo: 'X',
        general: [{ detalle: 'uno sigue uno' }, { detalle: 'dos' }],
        ...SIN_PLATAFORMA,
      },
    ]);
  });

  test('entrada vacía devuelve lista vacía', () => {
    expect(parsearNovedades('')).toEqual([]);
  });

  test('nunca lanza, ni con entradas raras', () => {
    expect(() => parsearNovedades('##\n-\n**\n   \n  - \n<!--\n-->')).not.toThrow();
  });
});

describe('parsearNovedades: sección en pruebas (#375)', () => {
  const SECCION = [
    '## En pruebas · próxima versión',
    '<!-- sincronizado-hasta: 5930146 #374 -->',
    '',
    '- **Detalle nuevo.** Se abre al costado <!-- #344 #350 -->',
    '  del listado.',
    '  - Entrá a una plantación.',
    '  - Esperá ver: el detalle a la derecha,',
    '    sin tapar el listado.',
    '',
    '## Web 1.1.0 · 21 de agosto de 2026',
    '',
    '- **Publicado.** Ya está en producción.',
  ].join('\n');

  test('los comentarios no se muestran y la marca queda en su entrada', () => {
    const [enPruebas, publicada] = parsearNovedades(SECCION);

    expect(enPruebas.sincronizadoHasta).toBe('5930146 #374');
    expect(enPruebas.general[0].detalle).toBe('Se abre al costado del listado.');
    expect(publicada.sincronizadoHasta).toBeUndefined();
  });

  test('los sub-bullets son pasos del ítem, uniendo su wrap', () => {
    const [enPruebas] = parsearNovedades(SECCION);

    expect(enPruebas.general[0].pasos).toEqual([
      'Entrá a una plantación.',
      'Esperá ver: el detalle a la derecha, sin tapar el listado.',
    ]);
  });

  test('una entrada publicada conserva sus pasos igual que la sección en pruebas (#580)', () => {
    const crudo = [
      '## Web 1.3.0 · 1 de octubre de 2026',
      '',
      '- **Publicado.** Con pasos.',
      '  - En la web, abrí Plantaciones.',
      '  - Esperá ver: el listado.',
    ].join('\n');

    expect(parsearNovedades(crudo)[0].general).toEqual([
      {
        titular: 'Publicado.',
        detalle: 'Con pasos.',
        pasos: ['En la web, abrí Plantaciones.', 'Esperá ver: el listado.'],
      },
    ]);
  });

  test('solo la entrada con el prefijo del contrato está en pruebas', () => {
    expect(parsearNovedades(SECCION).map(esEntradaEnPruebas)).toEqual([true, false]);
  });

  test('una línea que solo tiene un comentario no corta la continuación', () => {
    const crudo = ['## X', '', '- uno', '<!-- nota -->', '  sigue uno'].join('\n');

    expect(parsearNovedades(crudo)[0].general).toEqual([{ detalle: 'uno sigue uno' }]);
  });

  test('un paso sin ítem arriba se ignora', () => {
    expect(parsearNovedades('## X\n\n  - huérfano')).toEqual([
      { titulo: 'X', general: [], ...SIN_PLATAFORMA },
    ]);
  });

  test('un comentario sin cerrar queda como texto: no se come el resto', () => {
    expect(parsearNovedades('## X\n\n- uno <!-- abierto')[0].general).toEqual([
      { detalle: 'uno <!-- abierto' },
    ]);
  });
});

describe('parsearNovedades: plataformas (#918)', () => {
  const CON_PLATAFORMAS = [
    '## Web 1.4.0 · Mobile 1.3.0 · 24 de septiembre de 2026',
    '',
    '- Mejoras internas y de estabilidad.',
    '',
    '### Web',
    '',
    '- **Reabrí una plantación.** Desde Más acciones.',
    '  - En la web de pruebas, abrí una plantación finalizada.',
    '',
    '### App',
    '',
    '- **Aviso sin señal.** En vez del cargando.',
    '- **Código nuevo.** Actualiza los árboles.',
    '',
    '## Web 1.1.0 · 21 de agosto de 2026',
    '',
    '- **Suelto.** Sin sección.',
  ].join('\n');
  const [conPlataformas, siguiente] = parsearNovedades(CON_PLATAFORMAS);

  test('cada bullet cae en la plataforma de su ###, con sus pasos', () => {
    expect(conPlataformas.web).toEqual([
      {
        titular: 'Reabrí una plantación.',
        detalle: 'Desde Más acciones.',
        pasos: ['En la web de pruebas, abrí una plantación finalizada.'],
      },
    ]);
    expect(conPlataformas.app.map((item) => item.titular)).toEqual([
      'Aviso sin señal.',
      'Código nuevo.',
    ]);
  });

  test('lo anterior al primer ### es de toda la versión', () => {
    expect(conPlataformas.general).toEqual([{ detalle: 'Mejoras internas y de estabilidad.' }]);
  });

  test('la sección no se arrastra a la entrada siguiente', () => {
    expect(siguiente).toEqual({
      titulo: 'Web 1.1.0 · 21 de agosto de 2026',
      general: [{ titular: 'Suelto.', detalle: 'Sin sección.' }],
      ...SIN_PLATAFORMA,
    });
  });

  test('un ### desconocido manda lo que sigue a general', () => {
    const crudo = ['## X', '### Web', '- web', '### Otros', '- otro'].join('\n');

    expect(parsearNovedades(crudo)).toEqual([
      { titulo: 'X', general: [{ detalle: 'otro' }], web: [{ detalle: 'web' }], app: [] },
    ]);
  });

  test('el ### corta la continuación del bullet anterior', () => {
    const crudo = ['## X', '### Web', '- web', '### App', 'suelto', '- app'].join('\n');

    expect(parsearNovedades(crudo)[0].web).toEqual([{ detalle: 'web' }]);
  });
});
