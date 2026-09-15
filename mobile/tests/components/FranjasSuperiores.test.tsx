/**
 * El aviso de OTA aparece y desaparece en runtime, y cuando está es él —y no el
 * header— quien ocupa el inset de la status bar. Si los dos lo aplican queda una
 * franja vacía; si ninguno lo aplica el header se pega a la barra de
 * notificaciones (#446).
 */
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import FranjasSuperiores from '../../src/components/FranjasSuperiores';
import CustomHeader from '../../src/components/CustomHeader';
import { spacing } from '../../src/theme';

const MOCK_INSET_TOP = 40;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: MOCK_INSET_TOP, bottom: 24, left: 0, right: 0 }),
}));

jest.mock('../../src/config/entorno', () => ({
  ES_ENTORNO_DE_PRUEBAS: false,
  ETIQUETA_BUILD: 'v1.0.0 · a1b2c3d',
}));
const entornoMock = jest.requireMock('../../src/config/entorno') as { ES_ENTORNO_DE_PRUEBAS: boolean };

const mockUseUpdates = jest.fn();
jest.mock('expo-updates', () => ({
  useUpdates: () => mockUseUpdates(),
  reloadAsync: jest.fn().mockResolvedValue(undefined),
}));

function renderConHeader() {
  return render(
    <FranjasSuperiores>
      <CustomHeader title="Plantaciones" />
    </FranjasSuperiores>,
  );
}

type Nodo = { props: { style: StyleProp<ViewStyle>; testID?: string } };

function paddingTopDe(nodo: Nodo): number {
  return StyleSheet.flatten(nodo.props.style).paddingTop as number;
}

/** Las franjas y el header, en el orden en que se ven. */
function nodosRaiz(toJSON: () => unknown): Nodo[] {
  const raiz = toJSON() as Nodo[] | Nodo;
  return Array.isArray(raiz) ? raiz : [raiz];
}

/** El header va último: las franjas se renderizan antes que el navigator. */
function paddingTopDelHeader(toJSON: () => unknown): number {
  const nodos = nodosRaiz(toJSON);
  return paddingTopDe(nodos[nodos.length - 1]);
}

describe('FranjasSuperiores', () => {
  beforeEach(() => {
    mockUseUpdates.mockReturnValue({ isUpdatePending: false });
    entornoMock.ES_ENTORNO_DE_PRUEBAS = false;
  });

  it('sin update pendiente no muestra el aviso y el header ocupa el inset', () => {
    const { queryByTestId, getByText, toJSON } = renderConHeader();
    expect(queryByTestId('banner-actualizacion-lista')).toBeNull();
    expect(getByText('Plantaciones')).toBeTruthy();
    expect(paddingTopDelHeader(toJSON)).toBe(MOCK_INSET_TOP + spacing.sm);
  });

  it('con un update pendiente muestra el aviso arriba del header', () => {
    mockUseUpdates.mockReturnValue({ isUpdatePending: true });
    const { getByTestId } = renderConHeader();
    expect(getByTestId('banner-actualizacion-lista')).toBeTruthy();
  });

  it('cuando aparece el aviso, el inset pasa del header al aviso', () => {
    const { getByTestId, toJSON, rerender } = renderConHeader();
    expect(paddingTopDelHeader(toJSON)).toBe(MOCK_INSET_TOP + spacing.sm);

    mockUseUpdates.mockReturnValue({ isUpdatePending: true });
    rerender(
      <FranjasSuperiores>
        <CustomHeader title="Plantaciones" />
      </FranjasSuperiores>,
    );

    expect(paddingTopDe(getByTestId('banner-actualizacion-lista'))).toBe(MOCK_INSET_TOP + spacing.sm);
    // Lo tiene que soltar el header, o entre la status bar y el título queda el
    // inset aplicado dos veces.
    expect(paddingTopDelHeader(toJSON)).toBe(spacing.sm);
  });

  it('la ✕ descarta el aviso y el inset vuelve al header', () => {
    mockUseUpdates.mockReturnValue({ isUpdatePending: true });
    const { getByTestId, queryByTestId, toJSON } = renderConHeader();
    expect(paddingTopDelHeader(toJSON)).toBe(spacing.sm);

    fireEvent.press(getByTestId('banner-actualizacion-descartar'));

    expect(queryByTestId('banner-actualizacion-lista')).toBeNull();
    expect(paddingTopDelHeader(toJSON)).toBe(MOCK_INSET_TOP + spacing.sm);
  });

  // El orden visual vive en el JSX y la prioridad del inset en
  // `ocupanteDelInsetSuperior`: si se desincronizan, el inset queda en una franja
  // del medio y arriba de ella aparece una banda vacía.
  it('el inset lo ocupa la primera franja que se renderiza', () => {
    entornoMock.ES_ENTORNO_DE_PRUEBAS = true;
    mockUseUpdates.mockReturnValue({ isUpdatePending: true });
    const { toJSON } = renderConHeader();
    const [primera, ...siguientes] = nodosRaiz(toJSON);

    expect(primera.props.testID).toBe('banner-entorno-pruebas');
    expect(paddingTopDe(primera)).toBe(MOCK_INSET_TOP);
    expect(siguientes.map(paddingTopDe)).toEqual([spacing.sm, spacing.sm]);
  });

  it('en la app TEST el inset lo ocupa la franja de entorno, no el aviso', () => {
    entornoMock.ES_ENTORNO_DE_PRUEBAS = true;
    mockUseUpdates.mockReturnValue({ isUpdatePending: true });
    const { getByTestId } = renderConHeader();

    expect(paddingTopDe(getByTestId('banner-entorno-pruebas'))).toBe(MOCK_INSET_TOP);
    // El aviso va debajo de la franja amarilla: si también sumara el inset,
    // quedaría una banda vacía entre las dos.
    expect(paddingTopDe(getByTestId('banner-actualizacion-lista'))).toBe(spacing.sm);
  });
});
