import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import BannerEntornoPruebas from '../../src/components/BannerEntornoPruebas';

// jest.mock se hoistea por encima de los imports: los valores van adentro de la
// factory y se mutan vía requireMock (es el mismo objeto que ve el componente).
jest.mock('../../src/config/entorno', () => ({ ES_ENTORNO_DE_PRUEBAS: true, ETIQUETA_BUILD: 'v1.0.0 · a1b2c3d' }));
const entornoMock = jest.requireMock('../../src/config/entorno') as { ES_ENTORNO_DE_PRUEBAS: boolean };

const mockInsetTop = 40;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: mockInsetTop, bottom: 0, left: 0, right: 0 }),
}));

describe('BannerEntornoPruebas', () => {
  beforeEach(() => {
    entornoMock.ES_ENTORNO_DE_PRUEBAS = true;
  });

  it('en la app TEST muestra el aviso con la versión y el commit del build', () => {
    const { getByText } = render(<BannerEntornoPruebas />);
    expect(getByText('ENTORNO DE PRUEBAS · v1.0.0 · a1b2c3d')).toBeTruthy();
  });

  it('ocupa el inset superior (la status bar) para que el header no lo sume', () => {
    const { getByTestId } = render(<BannerEntornoPruebas />);
    const estilo = StyleSheet.flatten(getByTestId('banner-entorno-pruebas').props.style);
    expect(estilo.paddingTop).toBe(mockInsetTop);
  });

  it('en producción no renderiza nada', () => {
    entornoMock.ES_ENTORNO_DE_PRUEBAS = false;
    const { toJSON } = render(<BannerEntornoPruebas />);
    expect(toJSON()).toBeNull();
  });
});
