import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import CustomHeader from '../../src/components/CustomHeader';
import { spacing } from '../../src/theme';

jest.mock('../../src/config/entorno', () => ({ ES_ENTORNO_DE_PRUEBAS: false, VERSION_APP: 'v1.0.0 (1)' }));
const entornoMock = jest.requireMock('../../src/config/entorno') as { ES_ENTORNO_DE_PRUEBAS: boolean };

const mockInsetTop = 40;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: mockInsetTop, bottom: 0, left: 0, right: 0 }),
}));

/** El root del render es la barra del header (View con paddingTop). */
function paddingTopDelHeader(): number {
  const { toJSON } = render(<CustomHeader title="Plantaciones" />);
  const raiz = toJSON() as { props: { style: StyleProp<ViewStyle> } };
  return StyleSheet.flatten(raiz.props.style).paddingTop as number;
}

describe('CustomHeader · inset superior', () => {
  it('en producción suma el inset de la status bar', () => {
    entornoMock.ES_ENTORNO_DE_PRUEBAS = false;
    expect(paddingTopDelHeader()).toBe(mockInsetTop + spacing.sm);
  });

  it('en la app TEST no lo suma: el banner de entorno ya lo ocupa', () => {
    entornoMock.ES_ENTORNO_DE_PRUEBAS = true;
    expect(paddingTopDelHeader()).toBe(spacing.sm);
  });
});
