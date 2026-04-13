// Tests for AdminBottomSheet — estado-specific action rendering and callbacks.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AdminBottomSheet from '../../src/components/AdminBottomSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('../../src/theme', () => ({
  colors: {
    primary: '#0A3760',
    surface: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.6)',
    textHeading: '#1E293B',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    danger: '#DC2626',
    stateActiva: '#99B95B',
    stateFinalizada: '#F59E0B',
    stateSincronizada: '#0A3760',
    borderMuted: '#CBD5E1',
    surfaceAlt: '#F1F5F9',
    secondaryBg: '#FFF7ED',
    secondary: '#F59E0B',
    info: '#2563EB',
    border: '#E2E8F0',
    white: '#FFFFFF',
  },
  spacing: { xs: 4, sm: 6, md: 8, lg: 10, xl: 12, xxl: 16, '4xl': 24, '5xl': 32 },
  borderRadius: { md: 8, lg: 12, xl: 16, full: 9999 },
  fontSize: { xs: 10, sm: 12, base: 15, xl: 16, xxl: 18, title: 20 },
  fonts: { regular: 'System', bold: 'System', semiBold: 'System', medium: 'System', heading: 'System' },
}));

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

type BottomSheetProps = React.ComponentProps<typeof AdminBottomSheet>;

function makeProps(overrides?: Partial<BottomSheetProps>): BottomSheetProps {
  return {
    visible: true,
    plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'activa', createdAt: '2026-01-01' },
    meta: { canFinalize: false, idsGenerated: false },
    isAdmin: true,
    isOnline: true,
    onDismiss: jest.fn(),
    onSync: jest.fn(),
    onConfigSpecies: jest.fn(),
    onAssignTech: jest.fn(),
    onFinalize: jest.fn(),
    onGenerateIds: jest.fn(),
    onExportCsv: jest.fn(),
    onExportExcel: jest.fn(),
    onDiscardEdit: jest.fn(),
    ...overrides,
  };
}

describe('AdminBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders activa actions', () => {
    const { getByText } = render(<AdminBottomSheet {...makeProps()} />);

    expect(getByText('Configurar especies')).toBeTruthy();
    expect(getByText('Asignar tecnicos')).toBeTruthy();
    expect(getByText('Finalizar plantacion')).toBeTruthy();
  });

  it('shows disabled Finalizar helper when canFinalize=false', () => {
    const { getByText } = render(
      <AdminBottomSheet {...makeProps({ meta: { canFinalize: false, idsGenerated: false } })} />
    );

    expect(getByText('Para finalizar, todos los subgrupos deben estar sincronizados')).toBeTruthy();
  });

  it('shows enabled Finalizar when canFinalize=true', () => {
    const { queryByText } = render(
      <AdminBottomSheet {...makeProps({ meta: { canFinalize: true, idsGenerated: false } })} />
    );

    expect(queryByText('Para finalizar, todos los subgrupos deben estar sincronizados')).toBeNull();
  });

  it('shows pendingSync helper when plantation has pendingSync', () => {
    const { getByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'activa', createdAt: '2026-01-01', pendingSync: true },
        })}
      />
    );

    expect(getByText('Sincroniza los cambios antes de finalizar')).toBeTruthy();
  });

  it('renders Generar IDs for finalizada without IDs', () => {
    const { getByText, queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01' },
          meta: { canFinalize: false, idsGenerated: false },
        })}
      />
    );

    expect(getByText('Generar IDs')).toBeTruthy();
    expect(queryByText('Exportar CSV')).toBeNull();
  });

  it('renders export options for finalizada with IDs', () => {
    const { getByText, queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01' },
          meta: { canFinalize: false, idsGenerated: true },
        })}
      />
    );

    expect(getByText('Exportar CSV')).toBeTruthy();
    expect(getByText('Exportar Excel')).toBeTruthy();
    expect(queryByText('Generar IDs')).toBeNull();
  });

  it('shows Bloqueada badge for finalizada', () => {
    const { getByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01' },
          meta: { canFinalize: false, idsGenerated: false },
        })}
      />
    );

    expect(getByText('Bloqueada')).toBeTruthy();
  });

  it('renders no actions for sincronizada (estado removed per D-07)', () => {
    const { queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'sincronizada', createdAt: '2026-01-01' },
          meta: { canFinalize: false, idsGenerated: true },
        })}
      />
    );

    // sincronizada estado no longer exists — no actions rendered
    expect(queryByText('Exportar CSV')).toBeNull();
    expect(queryByText('Exportar Excel')).toBeNull();
    expect(queryByText('Configurar especies')).toBeNull();
    expect(queryByText('Generar IDs')).toBeNull();
  });

  it('calls onConfigSpecies when action tapped', () => {
    const onConfigSpecies = jest.fn();
    const { getByText } = render(
      <AdminBottomSheet {...makeProps({ onConfigSpecies })} />
    );

    fireEvent.press(getByText('Configurar especies'));

    expect(onConfigSpecies).toHaveBeenCalledTimes(1);
  });

  it('does not render content when visible=false', () => {
    const { queryByText } = render(
      <AdminBottomSheet {...makeProps({ visible: false })} />
    );

    // Modal not visible — inner content should not be rendered
    expect(queryByText('Finca Norte')).toBeNull();
  });
});
