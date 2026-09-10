import { screen } from '@testing-library/react';
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
      items: [
        {
          titular: 'Detalle al costado.',
          detalle: 'El árbol se abre sin tapar el listado.',
          pasos: ['Entrá a una plantación.', 'Esperá ver el detalle a la derecha.'],
        },
      ],
    },
    {
      titulo: 'Web 1.1.0 · 21 de agosto de 2026',
      items: [{ titular: 'Contraseña visible.', detalle: 'Ya publicado.' }],
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
  expect(await main.findByRole('heading', { name: 'Web 1.1.0 · 21 de agosto de 2026' })).toBeInTheDocument();
  expect(main.getByText(/Contraseña visible\./)).toBeInTheDocument();
});

test('la sección en pruebas avisa que todavía no está en producción', async () => {
  renderRutasEn('/novedades');

  const main = await esperarMain();
  expect(await main.findByRole('heading', { name: 'En pruebas · próxima versión' })).toBeInTheDocument();
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
  const resumen = await main.findByText('Cómo probarlo');
  const desplegable = resumen.closest('details');
  expect(desplegable).not.toHaveAttribute('open');

  await userEvent.click(resumen);

  expect(desplegable).toHaveAttribute('open');
  expect(main.getByText('Entrá a una plantación.')).toBeVisible();
});

test('entrar guarda la firma con la marca de sincronización', async () => {
  renderRutasEn('/novedades');
  const main = await esperarMain();
  await main.findByRole('heading', { name: 'Novedades' });

  expect(window.localStorage.getItem(CLAVE_ULTIMA_VISTA)).toBe('v1.1.0 · 5930146 #374');
});

test('el footer del sidebar linkea a novedades con el dot encendido', async () => {
  renderRutasEn('/plantaciones');

  const enlace = await screen.findByRole('link', { name: /Novedades, versión v.*hay novedades nuevas/ });
  expect(enlace).toHaveAttribute('href', '/novedades');
});
