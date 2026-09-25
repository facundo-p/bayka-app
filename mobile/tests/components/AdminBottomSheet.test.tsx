// Tests for AdminBottomSheet — estado-specific action rendering and callbacks.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AdminBottomSheet, { AVISO_IDS_DESDE_WEB } from '../../src/components/AdminBottomSheet';

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
    plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'activa', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null },
    meta: { canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
    isAdmin: true,
    canReopen: false,
    isOnline: true,
    onDismiss: jest.fn(),
    onEdit: jest.fn(),
    onConfigSpecies: jest.fn(),
    onAssignTech: jest.fn(),
    onFinalize: jest.fn(),
    onReopen: jest.fn(),
    onExportCsv: jest.fn(),
    onExportExcel: jest.fn(),
    onExportKml: jest.fn(),
    onDiscardEdit: jest.fn(),
    ...overrides,
  };
}

describe('AdminBottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders activa actions', () => {
    const { getByText, queryByText } = render(<AdminBottomSheet {...makeProps()} />);

    expect(getByText('Editar plantación')).toBeTruthy();
    expect(getByText('Configurar especies')).toBeTruthy();
    expect(getByText('Asignar técnicos')).toBeTruthy();
    expect(getByText('Finalizar plantación')).toBeTruthy();
    // #94: el sync por plantación vive en la card, no en el sheet.
    expect(queryByText('Sincronizar')).toBeNull();
  });

  // Antes se ofrecía en cualquier estado, heredado del reagrupamiento de #94.
  // Editar escribe lugar/período/config en `plantations`, así que cae bajo la
  // inmutabilidad de la plantación finalizada (#469).
  it('no ofrece Editar sobre una plantación finalizada', () => {
    const { queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null },
        })}
      />
    );

    expect(queryByText('Editar plantación')).toBeNull();
  });

  it('no ofrece ninguna acción de edición sobre una plantación archivada (#477)', () => {
    const { queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'activa', createdAt: '2026-01-01', archivadaEn: '2026-09-17T12:00:00+00:00', eliminadaEnServidorEn: null },
          meta: { canFinalize: true, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(queryByText('Editar plantación')).toBeNull();
    expect(queryByText('Configurar especies')).toBeNull();
    expect(queryByText('Asignar técnicos')).toBeNull();
    expect(queryByText('Finalizar plantación')).toBeNull();
  });

  it('no ofrece ninguna acción de edición sobre una plantación eliminada en el servidor (#478)', () => {
    const { queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'activa', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: '2026-09-17T12:00:00.000Z' },
          meta: { canFinalize: true, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(queryByText('Editar plantación')).toBeNull();
    expect(queryByText('Configurar especies')).toBeNull();
    expect(queryByText('Asignar técnicos')).toBeNull();
    expect(queryByText('Finalizar plantación')).toBeNull();
  });

  it('finalizada y archivada sigue exportando: exportar no escribe (#477)', () => {
    const { getByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01', archivadaEn: '2026-09-17T12:00:00+00:00', eliminadaEnServidorEn: null },
          meta: { canFinalize: false, idsGenerated: true, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(getByText('Exportar CSV')).toBeTruthy();
  });

  it('calls onEdit when Editar tapped', () => {
    const onEdit = jest.fn();
    const { getByText } = render(<AdminBottomSheet {...makeProps({ onEdit })} />);

    fireEvent.press(getByText('Editar plantación'));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders no actions for non-admin', () => {
    const { queryByText } = render(<AdminBottomSheet {...makeProps({ isAdmin: false })} />);

    expect(queryByText('Editar plantación')).toBeNull();
    expect(queryByText('Configurar especies')).toBeNull();
  });

  it('shows disabled Finalizar helper when canFinalize=false', () => {
    const { getByText } = render(
      <AdminBottomSheet {...makeProps({ meta: { canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' } })} />
    );

    expect(getByText('Para finalizar, todos los grupos deben estar sincronizados')).toBeTruthy();
  });

  it('con pendientes sin subir, la ayuda dice qué falta sincronizar (#537)', () => {
    const { getByText } = render(
      <AdminBottomSheet {...makeProps({ meta: { canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '2 fotos sin subir' } })} />
    );

    expect(getByText('Sincronizá antes de finalizar: 2 fotos sin subir')).toBeTruthy();
  });

  it('shows enabled Finalizar when canFinalize=true', () => {
    const { queryByText } = render(
      <AdminBottomSheet {...makeProps({ meta: { canFinalize: true, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' } })} />
    );

    expect(queryByText('Para finalizar, todos los grupos deben estar sincronizados')).toBeNull();
  });

  it('shows pendingSync helper when plantation has pendingSync', () => {
    const { getByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'activa', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null, pendingSync: true },
        })}
      />
    );

    expect(getByText('Sincronizá los cambios antes de finalizar')).toBeTruthy();
  });

  // #232: la generación de IDs es exclusiva de la web; mobile solo informa.
  it('shows the web-generation notice (no action) for finalizada without IDs', () => {
    const { getByText, queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null },
          meta: { canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(getByText(AVISO_IDS_DESDE_WEB)).toBeTruthy();
    expect(queryByText('Generar IDs')).toBeNull();
    expect(queryByText('Exportar CSV')).toBeNull();
  });

  it('renders export options for finalizada with IDs', () => {
    const { getByText, queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null },
          meta: { canFinalize: false, idsGenerated: true, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(getByText('Exportar CSV')).toBeTruthy();
    expect(getByText('Exportar Excel')).toBeTruthy();
    expect(queryByText(AVISO_IDS_DESDE_WEB)).toBeNull();
  });

  it('shows Bloqueada badge for finalizada', () => {
    const { getByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null },
          meta: { canFinalize: false, idsGenerated: false, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(getByText('Bloqueada')).toBeTruthy();
  });

  it('renders no actions for sincronizada (estado removed per D-07)', () => {
    const { queryByText } = render(
      <AdminBottomSheet
        {...makeProps({
          plantation: { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'sincronizada', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null },
          meta: { canFinalize: false, idsGenerated: true, unresolvedNNCount: 0, unresolvedNNGroups: 0, pendientesSinSubir: '' },
        })}
      />
    );

    expect(queryByText('Exportar CSV')).toBeNull();
    expect(queryByText('Exportar Excel')).toBeNull();
    expect(queryByText('Configurar especies')).toBeNull();
    expect(queryByText(AVISO_IDS_DESDE_WEB)).toBeNull();
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

    expect(queryByText('Finca Norte')).toBeNull();
  });

  describe('Reabrir (#637)', () => {
    const FINALIZADA = { id: 'p1', lugar: 'Finca Norte', periodo: '2026-A', estado: 'finalizada', createdAt: '2026-01-01', archivadaEn: null, eliminadaEnServidorEn: null };

    it('superadmin online: ofrece Reabrir sobre una finalizada y lo dispara', () => {
      const onReopen = jest.fn();
      const { getByText } = render(
        <AdminBottomSheet {...makeProps({ plantation: FINALIZADA, canReopen: true, onReopen })} />
      );

      fireEvent.press(getByText('Reabrir plantación'));

      expect(onReopen).toHaveBeenCalledTimes(1);
    });

    it('admin sin rol superadmin: no ve Reabrir', () => {
      const { queryByText } = render(
        <AdminBottomSheet {...makeProps({ plantation: FINALIZADA, canReopen: false })} />
      );

      expect(queryByText('Reabrir plantación')).toBeNull();
    });

    it('sin conexión: Reabrir se ve deshabilitado y explica por qué', () => {
      const onReopen = jest.fn();
      const { getByText } = render(
        <AdminBottomSheet {...makeProps({ plantation: FINALIZADA, canReopen: true, isOnline: false, onReopen })} />
      );

      fireEvent.press(getByText('Reabrir plantación'));

      expect(onReopen).not.toHaveBeenCalled();
      expect(getByText('Reabrir requiere conexión a internet')).toBeTruthy();
    });

    it('no se ofrece sobre una activa ni sobre una finalizada archivada', () => {
      const activa = render(<AdminBottomSheet {...makeProps({ canReopen: true })} />);
      expect(activa.queryByText('Reabrir plantación')).toBeNull();
      activa.unmount();

      const archivada = render(
        <AdminBottomSheet {...makeProps({ plantation: { ...FINALIZADA, archivadaEn: '2026-05-01' }, canReopen: true })} />
      );
      expect(archivada.queryByText('Reabrir plantación')).toBeNull();
    });
  });
});
