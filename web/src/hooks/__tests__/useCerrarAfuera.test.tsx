import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useCerrarAfuera } from '../useCerrarAfuera';

function Prueba({ cerrar }: { cerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const refExtra = useRef<HTMLDivElement>(null);
  useCerrarAfuera(true, cerrar, ref, refExtra);
  return (
    <>
      <div ref={ref}>adentro</div>
      <div ref={refExtra}>en portal</div>
      <div>afuera</div>
    </>
  );
}

test('un click en el ref o en el ref extra no cierra', () => {
  const cerrar = vi.fn();
  render(<Prueba cerrar={cerrar} />);
  fireEvent.mouseDown(screen.getByText('adentro'));
  fireEvent.mouseDown(screen.getByText('en portal'));
  expect(cerrar).not.toHaveBeenCalled();
});

test('un click afuera de ambos cierra', () => {
  const cerrar = vi.fn();
  render(<Prueba cerrar={cerrar} />);
  fireEvent.mouseDown(screen.getByText('afuera'));
  expect(cerrar).toHaveBeenCalledTimes(1);
});

test('Escape cierra', () => {
  const cerrar = vi.fn();
  render(<Prueba cerrar={cerrar} />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(cerrar).toHaveBeenCalledTimes(1);
});
