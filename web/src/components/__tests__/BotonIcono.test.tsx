import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotonIcono } from '../BotonIcono';

test('la etiqueta es el nombre accesible y no envía el form que lo contiene', async () => {
  const alEnviar = vi.fn((evento: SubmitEvent) => evento.preventDefault());
  render(
    <form onSubmit={(evento) => alEnviar(evento.nativeEvent as SubmitEvent)}>
      <BotonIcono variante="fantasma" etiqueta="Cerrar sesión">
        <svg />
      </BotonIcono>
    </form>,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

  expect(alEnviar).not.toHaveBeenCalled();
});

test('pasa disabled y los atributos que inyecta el disparador de un menú', () => {
  render(
    <BotonIcono variante="contorno" tamano="sm" etiqueta="Página anterior" disabled aria-expanded={false}>
      <svg />
    </BotonIcono>,
  );

  const boton = screen.getByRole('button', { name: 'Página anterior' });
  expect(boton).toBeDisabled();
  expect(boton).toHaveAttribute('aria-expanded', 'false');
});
