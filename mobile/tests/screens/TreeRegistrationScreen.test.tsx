// Cableado de la pantalla entre el aviso de reemplazo de foto y el visor (#751, #774).

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockPickPhoto = jest.fn();
const mockTreeReg = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'g1', plantacionId: 'p1', grupoCodigo: 'A', grupoNombre: 'Grupo A' }),
  useRouter: () => ({ back: jest.fn() }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useSegments: () => ['(tecnico)'],
}));
jest.mock('../../src/components/PhotoCropProvider', () => ({
  usePhotoCaptureFlow: () => ({ pickPhoto: mockPickPhoto }),
}));
jest.mock('../../src/hooks/useTreeRegistration', () => ({ useTreeRegistration: () => mockTreeReg() }));
jest.mock('../../src/hooks/useSpeciesOrder', () => ({
  useSpeciesOrder: () => ({ loading: true, orderedSpecies: [], reorderItems: [] }),
}));
jest.mock('../../src/hooks/useEstiloBotonera', () => ({ useEstiloBotonera: () => ({ estilo: 'grilla' }) }));
jest.mock('../../src/hooks/useCurrentUserId', () => ({ useCurrentUserId: () => 'u1' }));
const mockSinConflictos = () => ({ aviso: null as string | null, arbolesConCambios: new Set<string>(), resolver: jest.fn() });
const mockConflictosDeGrupo = jest.fn(mockSinConflictos);
jest.mock('../../src/hooks/useConflictosDeGrupo', () => ({ useConflictosDeGrupo: () => mockConflictosDeGrupo() }));
jest.mock('../../src/hooks/useGpsEnabledSetting', () => ({ useGpsEnabledSetting: () => ({ gpsEnabled: false }) }));
jest.mock('../../src/hooks/useGpsWatcher', () => ({ useGpsWatcher: () => ({ getLastFix: () => null }) }));
jest.mock('../../src/hooks/useGpsGate', () => ({ useGpsGate: () => ({ blocked: false }) }));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

function mockNull() { return null; }
jest.mock('../../src/components/ScreenContainer', () => {
  const { View } = require('react-native');
  return function MockScreenContainer({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  };
});
jest.mock('../../src/components/TreeRegistrationHeader', () => mockNull);
jest.mock('../../src/components/TreeStrip', () => mockNull);
jest.mock('../../src/components/SpeciesButtonGrid', () => mockNull);
jest.mock('../../src/components/SpeciesReorderModal', () => mockNull);
jest.mock('../../src/components/TreeDetailModal', () => mockNull);
jest.mock('../../src/components/TreeConfigModal', () => mockNull);
jest.mock('../../src/components/ReadOnlyTreeView', () => mockNull);
jest.mock('../../src/components/GpsGateBanner', () => mockNull);
jest.mock('../../src/components/TreeGpsRow', () => mockNull);
jest.mock('../../src/components/TreeListModal', () => {
  const { Pressable, Text } = require('react-native');
  return function MockTreeListModal({ onViewPhoto }: { onViewPhoto: (treeId: string, uri: string) => void }) {
    return (
      <Pressable onPress={() => onViewPhoto('t14', 'file:///a14.jpg')}>
        <Text>ver foto desde la lista</Text>
      </Pressable>
    );
  };
});
jest.mock('../../src/components/TreePhotoViewer', () => {
  const { Pressable, Text } = require('react-native');
  return function MockTreePhotoViewer({ foto, onReplace }: { foto: { uri: string } | null; onReplace: (f: unknown) => void }) {
    if (!foto) return null;
    return (
      <Pressable onPress={() => onReplace(foto)}>
        <Text testID="visor">{foto.uri}</Text>
      </Pressable>
    );
  };
});
jest.mock('../../src/components/ConfirmModal', () => {
  const { Pressable, Text, View } = require('react-native');
  return function MockConfirmModal({ visible, title, buttons }: {
    visible: boolean; title: string; buttons: { label: string; onPress: () => void }[];
  }) {
    if (!visible) return null;
    return (
      <View>
        <Text>{title}</Text>
        {buttons.map((b) => <Pressable key={b.label} onPress={b.onPress}><Text>{b.label}</Text></Pressable>)}
      </View>
    );
  };
});

import TreeRegistrationScreen from '../../src/screens/TreeRegistrationScreen';

const ARBOL = { id: 't14', subId: 'A-14', posicion: 14, fotoUrl: 'file:///a14.jpg', fotoSynced: true, latitude: null };

function setup() {
  const updatePhoto = jest.fn().mockResolvedValue(undefined);
  mockTreeReg.mockReturnValue({
    dataLoaded: true, isReadOnly: false, canReactivate: false, totalCount: 1, unresolvedNN: 0,
    sortedTrees: [ARBOL], finalizing: false, deleting: false, deletingTreeId: null,
    gpsCapturingTreeId: null, subgroup: null, subgroupEstado: 'activa', isCreator: true,
    plantacion: { estado: 'activa', archivada: false }, updatePhoto,
    addPhotoToTree: jest.fn().mockResolvedValue(undefined),
  });
  mockPickPhoto.mockResolvedValue('file:///nueva.jpg');
  return { screen: render(<TreeRegistrationScreen />), updatePhoto };
}

describe('TreeRegistrationScreen: aviso de reemplazo y visor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('«Ver actual» abre el visor y su Reemplazar no vuelve a preguntar', async () => {
    const { screen, updatePhoto } = setup();
    fireEvent.press(screen.getByTestId('foto-seleccionado-button'));
    expect(screen.getByText('Reemplazar la foto')).toBeTruthy();

    fireEvent.press(screen.getByText('Ver actual'));
    expect(screen.queryByText('Reemplazar la foto')).toBeNull();
    expect(screen.getByTestId('visor').props.children).toBe('file:///a14.jpg');

    await act(async () => { fireEvent.press(screen.getByTestId('visor')); });
    expect(screen.queryByText('Reemplazar la foto')).toBeNull();
    expect(mockPickPhoto).toHaveBeenCalledTimes(1);
    expect(updatePhoto).toHaveBeenCalledWith('t14', 'file:///nueva.jpg');
    expect(screen.getByTestId('visor').props.children).toBe('file:///nueva.jpg');
  });

  it('visor abierto desde la lista: Reemplazar sí pregunta antes de abrir la cámara', () => {
    const { screen } = setup();
    fireEvent.press(screen.getByText('ver foto desde la lista'));
    fireEvent.press(screen.getByTestId('visor'));
    expect(screen.getByText('Reemplazar la foto')).toBeTruthy();
    expect(screen.queryByText('Ver actual')).toBeNull();
    expect(mockPickPhoto).not.toHaveBeenCalled();
  });
});

describe('TreeRegistrationScreen: conflictos de sincronización (#804)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => mockConflictosDeGrupo.mockImplementation(mockSinConflictos));

  it('con conflictos, el aviso arriba lleva a resolverlos', () => {
    const resolver = jest.fn();
    const aviso = '1 árbol tiene cambios por resolver. El grupo no termina de sincronizarse hasta que elijas.';
    mockConflictosDeGrupo.mockReturnValue({ aviso, arbolesConCambios: new Set(['t14']), resolver });
    const { screen } = setup();

    expect(screen.getByText(aviso)).toBeTruthy();
    fireEvent.press(screen.getByText('Resolver'));

    expect(resolver).toHaveBeenCalled();
  });

  it('sin conflictos no hay aviso', () => {
    const { screen } = setup();
    expect(screen.queryByText('Resolver')).toBeNull();
  });
});
