// Tests for PlantationCard sidebar strip — role-aware icon rendering and callbacks.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PlantationCard from '../../src/components/PlantationCard';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');

jest.mock('../../src/theme', () => ({
  colors: {
    primary: '#0A3760',
    surface: '#FFFFFF',
    textMuted: '#94A3B8',
    stateActiva: '#99B95B',
    stateFinalizada: '#F59E0B',
    stateSincronizada: '#0A3760',
    textSecondary: '#64748B',
    background: '#FAFAF9',
    danger: '#DC2626',
    secondaryBg: '#FFF7ED',
    white: '#FFFFFF',
    secondary: '#F59E0B',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
    black: '#000000',
    statTotal: '#64748B',
    statSynced: '#0A3760',
    statToday: '#8B5CF6',
    textHeading: '#0A3760',
    textPrimary: '#1E293B',
    backgroundAlt: '#F5F5F4',
    borderMuted: '#CBD5E1',
  },
  spacing: { xs: 4, sm: 6, md: 8, lg: 10, xl: 12, xxl: 16, '4xl': 24, '5xl': 32 },
  borderRadius: { md: 8, lg: 12, xl: 16, full: 9999 },
  fontSize: { xs: 10, sm: 12, base: 15, xl: 16, xxl: 18, title: 20 },
  fonts: { regular: 'System', bold: 'System', semiBold: 'System', medium: 'System', heading: 'System' },
  iconSizes: { badge: 12 },
  chipSizes: { sm: { paddingVertical: 4, paddingHorizontal: 8 } },
}));

function makeProps(overrides?: Partial<React.ComponentProps<typeof PlantationCard>>) {
  return {
    lugar: 'Finca Norte',
    periodo: '2026-A',
    totalCount: 100,
    syncedCount: 80,
    todayCount: 10,
    pendingSync: 2,
    estado: 'activa',
    onPress: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    onGear: jest.fn(),
    isAdmin: false,
    ...overrides,
  };
}

describe('PlantationCard sidebar strip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 3 icons for admin', () => {
    const { getByLabelText } = render(<PlantationCard {...makeProps({ isAdmin: true })} />);

    expect(getByLabelText('Editar lugar y periodo')).toBeTruthy();
    expect(getByLabelText('Acciones de plantacion')).toBeTruthy();
    expect(getByLabelText('Eliminar plantacion del dispositivo')).toBeTruthy();
  });

  it('does not render gear icon for tecnico', () => {
    const { getByLabelText, queryByLabelText } = render(
      <PlantationCard {...makeProps({ isAdmin: false })} />
    );

    expect(getByLabelText('Editar lugar y periodo')).toBeTruthy();
    expect(getByLabelText('Acciones de plantacion')).toBeTruthy();
    expect(getByLabelText('Eliminar plantacion del dispositivo')).toBeTruthy();
  });

  it('calls onEdit when edit icon tapped', () => {
    const onEdit = jest.fn();
    const { getByLabelText } = render(<PlantationCard {...makeProps({ onEdit })} />);

    fireEvent.press(getByLabelText('Editar lugar y periodo'));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onGear when gear icon tapped (admin)', () => {
    const onGear = jest.fn();
    const { getByLabelText } = render(
      <PlantationCard {...makeProps({ isAdmin: true, onGear })} />
    );

    fireEvent.press(getByLabelText('Acciones de plantacion'));

    expect(onGear).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when trash icon tapped', () => {
    const onDelete = jest.fn();
    const { getByLabelText } = render(<PlantationCard {...makeProps({ onDelete })} />);

    fireEvent.press(getByLabelText('Eliminar plantacion del dispositivo'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders empty trash slot when onDelete not provided', () => {
    const { queryByLabelText } = render(
      <PlantationCard {...makeProps({ onDelete: undefined })} />
    );

    expect(queryByLabelText('Eliminar plantacion del dispositivo')).toBeNull();
  });
});

describe('PlantationCard badge "Oculta en app"', () => {
  it('lo muestra para admin cuando visibleInApp=false', () => {
    const { getByText } = render(
      <PlantationCard {...makeProps({ isAdmin: true, visibleInApp: false })} />
    );
    expect(getByText('Oculta en app')).toBeTruthy();
  });

  it('NO lo muestra para admin cuando la plantación es visible', () => {
    const { queryByText } = render(
      <PlantationCard {...makeProps({ isAdmin: true, visibleInApp: true })} />
    );
    expect(queryByText('Oculta en app')).toBeNull();
  });

  it('NO lo muestra para tecnico aunque visibleInApp=false', () => {
    const { queryByText } = render(
      <PlantationCard {...makeProps({ isAdmin: false, visibleInApp: false })} />
    );
    expect(queryByText('Oculta en app')).toBeNull();
  });
});
