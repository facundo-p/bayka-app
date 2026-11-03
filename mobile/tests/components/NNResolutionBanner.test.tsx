import { render, fireEvent } from '@testing-library/react-native';
import NNResolutionBanner from '../../src/components/NNResolutionBanner';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

describe('NNResolutionBanner', () => {
  it('sin N/N no renderiza nada', () => {
    const { toJSON } = render(<NNResolutionBanner totalNN={0} onResolve={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('muestra cuántos N/N hay para resolver, en singular y en plural', () => {
    expect(render(<NNResolutionBanner totalNN={1} onResolve={jest.fn()} />)
      .getByText('Resolver 1 N/N pendiente')).toBeTruthy();
    expect(render(<NNResolutionBanner totalNN={3} onResolve={jest.fn()} />)
      .getByText('Resolver 3 N/N pendientes')).toBeTruthy();
  });

  it('al tocarlo abre la resolución', () => {
    const onResolve = jest.fn();
    const { getByText } = render(<NNResolutionBanner totalNN={2} onResolve={onResolve} />);
    fireEvent.press(getByText('Resolver 2 N/N pendientes'));
    expect(onResolve).toHaveBeenCalledTimes(1);
  });
});
