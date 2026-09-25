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
    stateEliminada: '#DC2626',
    dangerBg: '#FEF2F2',
    conflictoBg: '#FEF2F2',
    conflictoBorder: '#F2A7A7',
    conflictoText: '#991B1B',
  },
  spacing: { xs: 4, sm: 6, md: 8, lg: 10, xl: 12, xxl: 16, '4xl': 24, '5xl': 32 },
  borderRadius: { md: 8, lg: 12, xl: 16, full: 9999 },
  fontSize: { xs: 10, sm: 12, base: 15, xl: 16, xxl: 18, title: 20 },
  fonts: { regular: 'System', bold: 'System', semiBold: 'System', medium: 'System', heading: 'System' },
  iconSizes: { badge: 12, stat: 14 },
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
    onSync: jest.fn(),
    onGear: jest.fn(),
    isAdmin: false,
    ...overrides,
  };
}

describe('PlantationCard sidebar strip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sync, gear and trash icons when all callbacks provided', () => {
    const { getByLabelText, queryByLabelText } = render(
      <PlantationCard {...makeProps({ isAdmin: true })} />
    );

    // #94: el botón Editar de la card fue reemplazado por Sync.
    expect(getByLabelText('Sincronizar plantación')).toBeTruthy();
    expect(queryByLabelText('Editar plantación')).toBeNull();
    expect(getByLabelText('Acciones de plantación')).toBeTruthy();
    expect(getByLabelText('Eliminar plantación del dispositivo')).toBeTruthy();
  });

  it('renders empty sync slot when onSync not provided (offline)', () => {
    const { queryByLabelText } = render(
      <PlantationCard {...makeProps({ onSync: undefined })} />
    );

    expect(queryByLabelText('Sincronizar plantación')).toBeNull();
  });

  it('renders empty gear slot when onGear not provided (tecnico)', () => {
    const { queryByLabelText } = render(
      <PlantationCard {...makeProps({ onGear: undefined })} />
    );

    expect(queryByLabelText('Acciones de plantación')).toBeNull();
  });

  it('calls onSync when sync icon tapped', () => {
    const onSync = jest.fn();
    const { getByLabelText } = render(<PlantationCard {...makeProps({ onSync })} />);

    fireEvent.press(getByLabelText('Sincronizar plantación'));

    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('long-press on the card calls onLongPress (abre edición, #94)', () => {
    const onLongPress = jest.fn();
    const onPress = jest.fn();
    const { getByText } = render(
      <PlantationCard {...makeProps({ onLongPress, onPress })} />
    );

    fireEvent(getByText('Finca Norte'), 'longPress');

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('calls onGear when gear icon tapped (admin)', () => {
    const onGear = jest.fn();
    const { getByLabelText } = render(
      <PlantationCard {...makeProps({ isAdmin: true, onGear })} />
    );

    fireEvent.press(getByLabelText('Acciones de plantación'));

    expect(onGear).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when trash icon tapped', () => {
    const onDelete = jest.fn();
    const { getByLabelText } = render(<PlantationCard {...makeProps({ onDelete })} />);

    fireEvent.press(getByLabelText('Eliminar plantación del dispositivo'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders empty trash slot when onDelete not provided', () => {
    const { queryByLabelText } = render(
      <PlantationCard {...makeProps({ onDelete: undefined })} />
    );

    expect(queryByLabelText('Eliminar plantación del dispositivo')).toBeNull();
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

describe('PlantationCard eliminada en el servidor (#478)', () => {
  it('muestra el badge para cualquier rol y conserva "eliminar del dispositivo"', () => {
    const { getByText, getByLabelText } = render(
      <PlantationCard {...makeProps({ isAdmin: false, eliminadaEnServidor: true })} />
    );
    expect(getByText('Eliminada en el servidor')).toBeTruthy();
    expect(getByLabelText('Eliminar plantación del dispositivo')).toBeTruthy();
  });

  it('sin la marca no hay badge', () => {
    const { queryByText } = render(<PlantationCard {...makeProps()} />);
    expect(queryByText('Eliminada en el servidor')).toBeNull();
  });

  it('con cambios por resolver muestra la marca y tocarla abre la pantalla, sin abrir la plantación', () => {
    const onResolverCambios = jest.fn();
    const props = makeProps({ onResolverCambios });
    const { getByLabelText } = render(<PlantationCard {...props} />);

    fireEvent.press(getByLabelText('Resolver cambios'), { stopPropagation: jest.fn() });

    expect(onResolverCambios).toHaveBeenCalled();
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it('sin cambios por resolver no hay marca', () => {
    const { queryByLabelText } = render(<PlantationCard {...makeProps()} />);
    expect(queryByLabelText('Resolver cambios')).toBeNull();
  });
});

describe('PlantationCard con pendientes varados (#638)', () => {
  const aviso = { titulo: '3 cambios no se pudieron subir', motivo: 'La plantación está finalizada.' };

  it('muestra el aviso con el motivo y "Descartar" no abre la plantación', () => {
    const onDescartar = jest.fn();
    const props = makeProps({ pendientesVarados: { ...aviso, onDescartar } });
    const { getByText, getByLabelText } = render(<PlantationCard {...props} />);

    expect(getByText(aviso.titulo)).toBeTruthy();
    expect(getByText(aviso.motivo)).toBeTruthy();
    fireEvent.press(getByLabelText('Descartar cambios sin subir'), { stopPropagation: jest.fn() });

    expect(onDescartar).toHaveBeenCalled();
    expect(props.onPress).not.toHaveBeenCalled();
  });

  it('con el aviso, los grupos pendientes no figuran como listos para sincronizar', () => {
    const { queryByText } = render(<PlantationCard {...makeProps({ pendientesVarados: { ...aviso, onDescartar: jest.fn() } })} />);
    expect(queryByText(/listos? para sincronizar/)).toBeNull();
  });

  it('sin varados no hay aviso', () => {
    const { queryByTestId, getByText } = render(<PlantationCard {...makeProps()} />);
    expect(queryByTestId('pendientes-varados-aviso')).toBeNull();
    expect(getByText(/listos para sincronizar/)).toBeTruthy();
  });
});
