import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Modal } from '../Modal';
import styles from '../Modal.module.css';

function renderModal(open = true) {
  const onClose = vi.fn();
  render(
    <Modal open={open} title="Confirmar" onClose={onClose}>
      <p>contenido</p>
    </Modal>,
  );
  return onClose;
}

test('cerrado no renderiza nada; abierto enfoca el dialog', () => {
  renderModal(false);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  renderModal(true);
  expect(screen.getByRole('dialog', { name: 'Confirmar' })).toHaveFocus();
});

test('cierra con Escape y click en overlay, no con click en el contenido', () => {
  const onClose = renderModal();
  fireEvent.click(screen.getByText('contenido'));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('dialog').parentElement!);
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('el Escape adentro cierra solo el modal: no le llega al panel de atrás', () => {
  const deAtras = vi.fn();
  document.addEventListener('keydown', deAtras);
  const onClose = renderModal();

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(deAtras).not.toHaveBeenCalled();
  document.removeEventListener('keydown', deAtras);
});

test('al cerrar devuelve el foco a lo que lo abrió', () => {
  function ConDisparador({ open }: { open: boolean }) {
    return (
      <>
        <button type="button">Abrir</button>
        <Modal open={open} title="Foto" onClose={() => {}}>
          <p>contenido</p>
        </Modal>
      </>
    );
  }
  const { rerender } = render(<ConDisparador open={false} />);
  screen.getByRole('button', { name: 'Abrir' }).focus();

  rerender(<ConDisparador open />);
  expect(screen.getByRole('dialog')).toHaveFocus();
  rerender(<ConDisparador open={false} />);

  expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
});

test('con encabezadoPropio el título queda solo como nombre del dialog', () => {
  render(
    <Modal open title="Detalle de Anchico" onClose={() => {}} encabezadoPropio>
      <h2>Anchico</h2>
    </Modal>,
  );
  expect(screen.getByRole('dialog', { name: 'Detalle de Anchico' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Anchico' })).toBeInTheDocument();
});

test('capa detalle: el fondo va en su escalón, debajo de los diálogos', () => {
  const { rerender } = render(
    <Modal open title="Detalle" onClose={() => {}} capa="detalle">
      <p>contenido</p>
    </Modal>,
  );
  expect(screen.getByRole('dialog').parentElement!.className).toContain(styles.capaDetalle);

  rerender(
    <Modal open title="Detalle" onClose={() => {}}>
      <p>contenido</p>
    </Modal>,
  );
  expect(screen.getByRole('dialog').parentElement!.className).not.toContain(styles.capaDetalle);
});
