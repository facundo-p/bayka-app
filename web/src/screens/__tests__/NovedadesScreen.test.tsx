import { screen, within } from '@testing-library/react';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

const CLAVE_ULTIMA_VISTA = 'bayka.novedades.ultima-vista';

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  // Un admin alcanza: /novedades no está bajo RequireSuperadmin.
  estadoMock.perfilFila = PERFIL_ADMIN;
  estadoMock.resolverConsulta = () => ({ data: [], error: null, count: 0 });
  window.localStorage.clear();
});

/** El contenido vive en <main>; acotamos ahí para no chocar con el sidebar.
 *  Se espera el <main> porque la ruta monta recién cuando resuelve la sesión. */
async function enMain() {
  return within(await screen.findByRole('main'));
}

test('lista las entradas del changelog público real', async () => {
  renderRutasEn('/novedades');

  // Los títulos salen del NOVEDADES.md del repo, importado con ?raw.
  const main = await enMain();
  expect(
    await main.findByRole('heading', { name: 'Web 1.1.0 · 21 de agosto de 2026' }),
  ).toBeInTheDocument();
  expect(
    main.getByRole('heading', { name: 'Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026' }),
  ).toBeInTheDocument();
  expect(main.getByText(/Mostrá u ocultá tu contraseña\./)).toBeInTheDocument();
});

test('muestra la versión que se está usando', async () => {
  renderRutasEn('/novedades');

  const main = await enMain();
  expect(await main.findByText(/Estás usando la versión v/)).toBeInTheDocument();
});

test('entrar marca las novedades como vistas', async () => {
  renderRutasEn('/novedades');
  const main = await enMain();
  await main.findByRole('heading', { name: 'Novedades' });

  expect(window.localStorage.getItem(CLAVE_ULTIMA_VISTA)).toMatch(/^v/);
});

test('el footer del sidebar linkea a novedades con el dot encendido', async () => {
  renderRutasEn('/plantaciones');

  const enlace = await screen.findByRole('link', { name: /Novedades, versión v.*hay novedades nuevas/ });
  expect(enlace).toHaveAttribute('href', '/novedades');
});
