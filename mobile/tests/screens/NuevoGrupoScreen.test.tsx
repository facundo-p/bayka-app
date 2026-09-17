import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseNewGroup = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ plantacionId: 'plant-1', parcelaId: 'parc-1' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('../../src/hooks/useRoutePrefix', () => ({ useRoutePrefix: () => 'admin' }));
jest.mock('../../src/hooks/useNewGroup', () => ({ useNewGroup: () => mockUseNewGroup() }));
jest.mock('../../src/hooks/useGrupoForm', () => ({
  useGrupoForm: () => ({ handleSubmit: jest.fn(), canSubmit: true, loading: false }),
}));
jest.mock('../../src/components/EntityFormModal', () => {
  const { View } = require('react-native');
  return function MockEntityFormModal({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
    return <View>{children}{footer}</View>;
  };
});
jest.mock('../../src/components/GrupoFields', () => {
  const { Text: MockText } = require('react-native');
  return function MockGrupoFields() {
    return <MockText>campos del grupo</MockText>;
  };
});
jest.mock('../../src/components/FormActions', () => {
  const { Text: MockText } = require('react-native');
  return function MockFormActions({ submitDisabled }: { submitDisabled?: boolean }) {
    return <MockText testID="submit">{submitDisabled ? 'deshabilitado' : 'habilitado'}</MockText>;
  };
});
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

import NuevoGrupoScreen from '../../src/screens/NuevoGrupoScreen';

const EDITABLE = {
  lastGroupName: null,
  handleCreateGroup: jest.fn(),
  estadoLoaded: true,
  plantacionEditable: true,
  isArchivada: false,
  isFinalizada: false,
};

function renderCon(estado: Partial<typeof EDITABLE>) {
  mockUseNewGroup.mockReturnValue({ ...EDITABLE, ...estado });
  return render(<NuevoGrupoScreen />);
}

describe('NuevoGrupoScreen', () => {
  test('plantación editable: muestra el formulario y deja crear', () => {
    const screen = renderCon({});
    expect(screen.getByText('campos del grupo')).toBeTruthy();
    expect(screen.getByTestId('submit').props.children).toBe('habilitado');
  });

  test('archivada: sin formulario, submit deshabilitado y el motivo a la vista', () => {
    const screen = renderCon({ plantacionEditable: false, isArchivada: true });
    expect(screen.queryByText('campos del grupo')).toBeNull();
    expect(screen.getByTestId('submit').props.children).toBe('deshabilitado');
    expect(screen.getByText('No se pueden crear grupos en una plantación archivada.')).toBeTruthy();
  });

  test('finalizada: sin formulario, submit deshabilitado y el motivo a la vista', () => {
    const screen = renderCon({ plantacionEditable: false, isFinalizada: true });
    expect(screen.queryByText('campos del grupo')).toBeNull();
    expect(screen.getByTestId('submit').props.children).toBe('deshabilitado');
    expect(screen.getByText('No se pueden crear grupos en una plantación finalizada.')).toBeTruthy();
  });

  test('sin cargar el estado: no deja crear todavía', () => {
    const screen = renderCon({ estadoLoaded: false, plantacionEditable: false });
    expect(screen.getByTestId('submit').props.children).toBe('deshabilitado');
  });
});
