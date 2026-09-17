import { render, screen } from '@testing-library/react';
import { BarraHerramientas, RecuentoItem } from '../BarraHerramientas';

function renderRecuento(cantidad: number) {
  render(
    <BarraHerramientas
      recuento={
        <RecuentoItem cantidad={cantidad} sustantivo={{ singular: 'árbol', plural: 'árboles' }} />
      }
    />,
  );
}

test('RecuentoItem: la cifra formateada y destacada, y el sustantivo en plural', () => {
  renderRecuento(1234);
  expect(screen.getByText('1.234').tagName).toBe('STRONG');
  expect(screen.getByText('1.234').parentElement).toHaveTextContent('1.234 árboles');
});

test.each([
  [0, '0 árboles'],
  [1, '1 árbol'],
  [2, '2 árboles'],
])('RecuentoItem con %i: "%s"', (cantidad, texto) => {
  renderRecuento(cantidad);
  expect(screen.getByText(String(cantidad)).parentElement).toHaveTextContent(texto);
});
