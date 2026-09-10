import novedadesRaw from '../../../../NOVEDADES.md?raw';
import { entradasVisibles } from '../novedades';
import { esEntradaEnPruebas, parsearNovedades } from '../parsearNovedades';

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
    expect(publicadas.filter((entrada) => entrada.items.length === 0)).toEqual([]);
  });

  test('la sección en pruebas, si está, es una sola y va arriba de todo', () => {
    expect(entradas.slice(1).filter(esEntradaEnPruebas)).toEqual([]);
  });

  test('fuera de staging no se ve ninguna entrada en pruebas', () => {
    expect(entradasVisibles(entradas, false).filter(esEntradaEnPruebas)).toEqual([]);
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
    expect(nueva.items).toEqual([
      {
        titular: 'Mostrá u ocultá tu contraseña.',
        detalle:
          'El inicio de sesión y los formularios de contraseña ahora tienen un botón con forma de ojo.',
      },
    ]);
  });

  test('el bullet sin bold queda como puro detalle', () => {
    expect(primera.items).toEqual([
      {
        detalle:
          'Primera versión numerada de Bayka: la gestión web para administrar plantaciones y la app Android.',
      },
    ]);
  });
});

describe('parsearNovedades: contrato', () => {
  test('ignora todo lo anterior al primer ##, incluido el h1 y los bullets sueltos', () => {
    const crudo = ['# Titulo', '', '- bullet huérfano', '', '## Web 1.0.0', '', '- real'].join('\n');

    expect(parsearNovedades(crudo)).toEqual([
      { titulo: 'Web 1.0.0', items: [{ detalle: 'real' }] },
    ]);
  });

  test('una entrada sin bullets se conserva', () => {
    expect(parsearNovedades('## Web 2.0.0')).toEqual([{ titulo: 'Web 2.0.0', items: [] }]);
  });

  test('titular sin detalle deja el detalle vacío', () => {
    expect(parsearNovedades('## X\n\n- **Solo titular.**')).toEqual([
      { titulo: 'X', items: [{ titular: 'Solo titular.', detalle: '' }] },
    ]);
  });

  test('bold sin cerrar no rompe: cae entero a detalle', () => {
    expect(parsearNovedades('## X\n\n- **Sin cerrar y sigue')).toEqual([
      { titulo: 'X', items: [{ detalle: '**Sin cerrar y sigue' }] },
    ]);
  });

  test('la línea en blanco corta la continuación: no se pega al bullet anterior', () => {
    const crudo = ['## X', '', '- uno', '  sigue uno', '', 'texto suelto', '', '- dos'].join('\n');

    expect(parsearNovedades(crudo)).toEqual([
      { titulo: 'X', items: [{ detalle: 'uno sigue uno' }, { detalle: 'dos' }] },
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
    expect(enPruebas.items[0].detalle).toBe('Se abre al costado del listado.');
    expect(publicada.sincronizadoHasta).toBeUndefined();
  });

  test('los sub-bullets son pasos del ítem, uniendo su wrap', () => {
    const [enPruebas] = parsearNovedades(SECCION);

    expect(enPruebas.items[0].pasos).toEqual([
      'Entrá a una plantación.',
      'Esperá ver: el detalle a la derecha, sin tapar el listado.',
    ]);
  });

  test('solo la entrada con el prefijo del contrato está en pruebas', () => {
    expect(parsearNovedades(SECCION).map(esEntradaEnPruebas)).toEqual([true, false]);
  });

  test('una línea que solo tiene un comentario no corta la continuación', () => {
    const crudo = ['## X', '', '- uno', '<!-- nota -->', '  sigue uno'].join('\n');

    expect(parsearNovedades(crudo)[0].items).toEqual([{ detalle: 'uno sigue uno' }]);
  });

  test('un paso sin ítem arriba se ignora', () => {
    expect(parsearNovedades('## X\n\n  - huérfano')).toEqual([{ titulo: 'X', items: [] }]);
  });

  test('un comentario sin cerrar queda como texto: no se come el resto', () => {
    expect(parsearNovedades('## X\n\n- uno <!-- abierto')[0].items).toEqual([
      { detalle: 'uno <!-- abierto' },
    ]);
  });
});
