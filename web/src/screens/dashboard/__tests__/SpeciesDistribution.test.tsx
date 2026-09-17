import { render, screen } from '@testing-library/react';
import { SpeciesDistribution } from '../SpeciesDistribution';

test.each([
  [0, '0', 'especies'],
  [1, '1', 'especie'],
  [2, '2', 'especies'],
  [1000, '1.000', 'especies'],
])('el conteo de %i especies se lee "%s %s"', (totalEspecies, numero, etiqueta) => {
  render(<SpeciesDistribution especies={[]} total={0} totalEspecies={totalEspecies} />);

  expect(screen.getByText(etiqueta).parentElement).toHaveTextContent(`${numero}${etiqueta}`);
});
