import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { prepararSesionAdmin } from '../../test/supabaseMock';
import { esperarMain, renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// Fixture en vez del NOVEDADES.md real: cada release le agrega entradas arriba.
// Es lo que `lib/novedades` deja pasar en staging, con la sección en pruebas arriba.
vi.mock('../../lib/novedades', () => ({
  ENTRADAS: [
    {
      titulo: 'En pruebas · próxima versión',
      sincronizadoHasta: '5930146 #374',
      general: [],
      web: [
        {
          titular: 'Detalle al costado.',
          detalle: 'El árbol se abre sin tapar el listado.',
          pasos: ['Entrá a una plantación.', 'Esperá ver el detalle a la derecha.'],
        },
      ],
      app: [{ titular: 'Aviso sin señal.', detalle: 'En vez del cargando.' }],
    },
    {
      titulo: 'Web 1.1.0 · 21 de agosto de 2026',
      general: [{ detalle: 'Mejoras internas y de estabilidad.' }],
      web: [
        {
          titular: 'Contraseña visible.',
          detalle: 'Ya publicado.',
          pasos: ['Abrí el inicio de sesión.', 'Esperá ver: el botón con forma de ojo.'],
        },
      ],
      app: [],
    },
  ],
  FIRMA_NOVEDADES: 'v1.1.0 · 5930146 #374',
}));

const CLAVE_ULTIMA_VISTA = 'bayka.novedades.ultima-vista';

beforeEach(() => {
  // Un admin alcanza: /novedades no está bajo RequireSuperadmin.
  prepararSesionAdmin();
  window.localStorage.clear();
});

test('una tarjeta por entrada, con sus ítems', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  expect(
    await main.findByRole('heading', { name: 'Web 1.1.0 · 21 de agosto de 2026' }),
  ).toBeInTheDocument();
  expect(main.getByText(/Contraseña visible\./)).toBeInTheDocument();
});

test('cada entrada separa sus ítems por plataforma y omite la que no tiene', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  const columnaDe = (titular: string) => within(main.getByText(titular).closest('div')!);

  expect(await main.findAllByRole('heading', { level: 3 })).toHaveLength(3);
  expect(columnaDe('Detalle al costado.').getByRole('heading', { name: 'Web' })).toBeVisible();
  expect(columnaDe('Aviso sin señal.').getByRole('heading', { name: 'App' })).toBeVisible();
  expect(columnaDe('Contraseña visible.').getByRole('heading', { name: 'Web' })).toBeVisible();
  expect(main.getByText('Mejoras internas y de estabilidad.')).toBeVisible();
});

test('la sección en pruebas avisa que todavía no está en producción', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  expect(
    await main.findByRole('heading', { name: 'En pruebas · próxima versión' }),
  ).toBeInTheDocument();
  expect(main.getByText('Todavía no está en producción')).toBeInTheDocument();
});

test('muestra la versión que se está usando', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  expect(await main.findByText(/Estás usando la versión v/)).toBeInTheDocument();
});

test('los pasos de prueba arrancan plegados y se abren con "Cómo probarlo"', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  const [resumen] = await main.findAllByText('Cómo probarlo');
  const desplegable = resumen.closest('details');
  expect(desplegable).not.toHaveAttribute('open');

  await userEvent.click(resumen);

  expect(desplegable).toHaveAttribute('open');
  expect(main.getByText('Entrá a una plantación.')).toBeVisible();
});

// En el entorno de pruebas la entrada publicada también muestra sus pasos (#580, #582).
test('una entrada publicada también tiene su "Cómo probarlo"', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  const resumenes = await main.findAllByText('Cómo probarlo');
  expect(resumenes).toHaveLength(2);

  await userEvent.click(resumenes[1]);

  expect(main.getByText('Abrí el inicio de sesión.')).toBeVisible();
});

test('entrar guarda la firma con la marca de sincronización', async () => {
  renderRutasEn('/novedades');
  const main = await esperarMain();
  await main.findByRole('heading', { name: 'Novedades' });

  expect(window.localStorage.getItem(CLAVE_ULTIMA_VISTA)).toBe('v1.1.0 · 5930146 #374');
});

test('el footer del sidebar linkea a novedades con el dot encendido', async () => {
  renderRutasEn('/plantaciones');

  const enlace = await screen.findByRole('link', {
    name: /Novedades, versión v.*hay novedades nuevas/,
  });
  expect(enlace).toHaveAttribute('href', '/novedades');
});
