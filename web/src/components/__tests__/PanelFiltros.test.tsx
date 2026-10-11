import { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelFiltros } from '../PanelFiltros';

interface Opciones {
  activos?: number;
  onLimpiar?: () => void;
}

/** Un panel con un segmentado de foco itinerante y un select, y un input afuera. */
function renderPanel({ activos = 0, onLimpiar }: Opciones = {}) {
  render(
    <>
      <PanelFiltros
        titulo="Filtros de prueba"
        activos={activos}
        onLimpiar={onLimpiar}
        recuento="3 plantaciones"
      >
        <div role="radiogroup" aria-label="Estado">
          <button type="button" role="radio" aria-checked="false" tabIndex={-1}>
            Todas
          </button>
          <button type="button" role="radio" aria-checked="true">
            Activas
          </button>
        </div>
        <select aria-label="Temporada" />
      </PanelFiltros>
      <input aria-label="Afuera" />
      <p>Texto inerte</p>
    </>,
  );
  return {
    usuario: userEvent.setup(),
    boton: screen.getByRole('button', { name: /^Filtros/ }),
  };
}

const panel = () => screen.queryByRole('dialog', { name: 'Filtros de prueba' });

test('el botón anuncia el panel que abre y su estado', async () => {
  const { usuario, boton } = renderPanel();
  expect(boton).toHaveAttribute('aria-haspopup', 'dialog');
  expect(boton).toHaveAttribute('aria-expanded', 'false');
  expect(boton).not.toHaveAttribute('aria-controls');

  await usuario.click(boton);
  expect(boton).toHaveAttribute('aria-expanded', 'true');
  expect(boton).toHaveAttribute('aria-controls', panel()!.id);
});

test('al abrir, el foco va al primer control que alcanza el Tab', async () => {
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);
  expect(screen.getByRole('radio', { name: 'Activas' })).toHaveFocus();
});

test('el botón vuelve a cerrarlo', async () => {
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);
  await usuario.click(boton);
  expect(panel()).not.toBeInTheDocument();
});

/** Un `keydown` en `document`, como el del panel de detalle que queda atrás. */
function escucharDeAtras() {
  const deAtras = vi.fn();
  function OyenteDeAtras() {
    useEffect(() => {
      document.addEventListener('keydown', deAtras);
      return () => document.removeEventListener('keydown', deAtras);
    }, []);
    return null;
  }
  render(<OyenteDeAtras />);
  return deAtras;
}

test('Escape lo cierra, devuelve el foco al botón y no llega a lo de atrás', async () => {
  const deAtras = escucharDeAtras();
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);

  await usuario.keyboard('{Escape}');
  expect(panel()).not.toBeInTheDocument();
  await waitFor(() => expect(boton).toHaveFocus());
  expect(deAtras).not.toHaveBeenCalled();
});

test('tras un clic en el texto del panel, Escape tampoco llega a lo de atrás', async () => {
  const deAtras = escucharDeAtras();
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);

  await usuario.click(screen.getByText(/se aplican al toque/));
  expect(panel()).toBeInTheDocument();
  await usuario.keyboard('{Escape}');
  expect(panel()).not.toBeInTheDocument();
  expect(deAtras).not.toHaveBeenCalled();
  await waitFor(() => expect(boton).toHaveFocus());
});

test('un clic en un área inerte lo cierra y el foco vuelve al botón', async () => {
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);

  await usuario.click(screen.getByText('Texto inerte'));
  expect(panel()).not.toBeInTheDocument();
  await waitFor(() => expect(boton).toHaveFocus());
});

test('un clic en otro control lo cierra y el foco se queda en ese control', async () => {
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);

  const afuera = screen.getByLabelText('Afuera');
  await usuario.click(afuera);
  expect(panel()).not.toBeInTheDocument();
  await new Promise((resolver) => setTimeout(resolver));
  expect(afuera).toHaveFocus();
});

test('el Tab recorre el panel y, al salir de él, lo cierra', async () => {
  const { usuario, boton } = renderPanel({ activos: 1, onLimpiar: vi.fn() });
  await usuario.click(boton);

  await usuario.tab();
  expect(screen.getByLabelText('Temporada')).toHaveFocus();
  await usuario.tab();
  expect(screen.getByRole('button', { name: 'Limpiar' })).toHaveFocus();
  await usuario.tab();
  expect(screen.getByLabelText('Afuera')).toHaveFocus();
  expect(panel()).not.toBeInTheDocument();
});

test('limpiar se ofrece solo con filtros puestos, y deja el foco en el primer filtro', async () => {
  const onLimpiar = vi.fn();
  const { usuario, boton } = renderPanel({ activos: 1, onLimpiar });
  await usuario.click(boton);

  await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
  expect(onLimpiar).toHaveBeenCalledOnce();
  expect(screen.getByRole('radio', { name: 'Activas' })).toHaveFocus();
});

test('sin filtros puestos, limpiar está deshabilitado', async () => {
  const { usuario, boton } = renderPanel({ activos: 0, onLimpiar: vi.fn() });
  await usuario.click(boton);
  expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled();
});

test('el pie repite el recuento', async () => {
  const { usuario, boton } = renderPanel();
  await usuario.click(boton);
  expect(panel()).toHaveTextContent('3 plantaciones');
});
