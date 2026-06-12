import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Modal } from '../Modal';

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
