import { render, screen } from '@testing-library/react';
import { BarraHerramientas, RecuentoItem } from '../BarraHerramientas';

function renderRecuento(cantidad: number) {
  render(
    <BarraHerramientas
      recuento={<RecuentoItem cantidad={cantidad} singular="árbol" plural="árboles" />}
    />,
  );
}

test('RecuentoItem: la cifra formateada y destacada, y el sustantivo en plural', () => {
  renderRecuento(1234);
  expect(screen.getByText('1.234').tagName).toBe('STRONG');
  expect(screen.getByText('1.234').parentElement).toHaveTextContent('1.234 árboles');
});

test('RecuentoItem: con uno, el sustantivo va en singular', () => {
  renderRecuento(1);
  expect(screen.getByText('1').parentElement).toHaveTextContent('1 árbol');
});
