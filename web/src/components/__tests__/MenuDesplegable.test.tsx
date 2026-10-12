import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MenuDesplegable } from '../MenuDesplegable';
import { Modal } from '../Modal';

function MenuConModal({ alElegirOtro = () => {} }: { alElegirOtro?: () => void }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  return (
    <>
      <MenuDesplegable
        etiqueta="Exportar"
        disparador={(props) => (
          <button type="button" {...props}>
            Exportar
          </button>
        )}
        items={[
          { clave: 'informe', etiqueta: 'Informe PDF', onSeleccionar: () => setModalAbierto(true) },
          { clave: 'otro', etiqueta: 'Descargar KML', onSeleccionar: alElegirOtro },
        ]}
      />
      <Modal
        open={modalAbierto}
        title="Opciones del informe"
        onClose={() => setModalAbierto(false)}
      >
        <p>contenido</p>
      </Modal>
    </>
  );
}

async function abrirMenu(alElegirOtro?: () => void) {
  const usuario = userEvent.setup();
  render(<MenuConModal alElegirOtro={alElegirOtro} />);
  const disparador = screen.getByRole('button', { name: 'Exportar' });
  await usuario.click(disparador);
  return { usuario, disparador };
}

test('el modal abierto desde un ítem devuelve el foco al disparador al cerrarse con Escape', async () => {
  const { usuario, disparador } = await abrirMenu();

  await usuario.click(screen.getByRole('menuitem', { name: 'Informe PDF' }));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Opciones del informe' })).toHaveFocus();

  await usuario.keyboard('{Escape}');

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(disparador).toHaveFocus();
});

test('un ítem que no abre modal deja el foco en el disparador', async () => {
  const alElegirOtro = vi.fn();
  const { usuario, disparador } = await abrirMenu(alElegirOtro);

  await usuario.click(screen.getByRole('menuitem', { name: 'Descargar KML' }));

  expect(alElegirOtro).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(disparador).toHaveFocus();
});

test('Escape con el menú abierto lo cierra y el foco sigue en el disparador', async () => {
  const { usuario, disparador } = await abrirMenu();

  await usuario.keyboard('{Escape}');

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(disparador).toHaveFocus();
});

test('Escape desde un ítem enfocado con Tab cierra el menú y devuelve el foco al disparador', async () => {
  const usuario = userEvent.setup();
  render(<MenuConModal />);
  const disparador = screen.getByRole('button', { name: 'Exportar' });

  await usuario.tab();
  expect(disparador).toHaveFocus();
  await usuario.keyboard('{Enter}');
  await usuario.tab();
  expect(screen.getByRole('menuitem', { name: 'Informe PDF' })).toHaveFocus();

  await usuario.keyboard('{Escape}');

  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(disparador).toHaveFocus();
});
