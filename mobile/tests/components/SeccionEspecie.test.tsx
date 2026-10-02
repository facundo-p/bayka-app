// Cambiar la especie desde el detalle del árbol (#679).

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SeccionEspecie, { AVISO_REABRIR_GRUPO, ETIQUETA_CAMBIAR_ESPECIE } from '../../src/components/SeccionEspecie';
import {
  etiquetaEspecieDelServidor,
  etiquetaEspecieLocal,
  textoConflictoDeEspecie,
  textoConflictoSoloLectura,
} from '../../src/components/AvisoDeConflictoDeEspecie';
import { ESPECIE_DESCONOCIDA } from '../../src/services/sync/conflictosDeEspecie';
import ConfirmModal from '../../src/components/ConfirmModal';
import { useConfirm } from '../../src/hooks/useConfirm';
import { PLACEHOLDER_BUSCAR_ESPECIE, TEXTO_SIN_COINCIDENCIAS } from '../../src/components/SelectorDeEspecie';
import type { CambioDeEspecie } from '../../src/utils/permisosDeEdicion';
import type { TreeDetail } from '../../src/hooks/useTreeDetail';

const mockCambiarEspecie = jest.fn();
const mockUsarEspecieDelServidor = jest.fn();
const mockMantenerEspecieLocal = jest.fn();
const mockAvisoBreve = jest.fn();

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: () => ({
    data: [
      { especieId: 'e1', nombre: 'Ceibo', nombreCientifico: 'Erythrina crista-galli', codigo: 'CEI' },
      { especieId: 'e2', nombre: 'Álamo', nombreCientifico: 'Populus alba', codigo: 'ALA' },
      { especieId: 'e3', nombre: 'Tala', nombreCientifico: 'Celtis tala', codigo: 'TAL' },
    ],
  }),
}));
jest.mock('../../src/repositories/TreeRepository', () => ({
  cambiarEspecie: (...args: unknown[]) => mockCambiarEspecie(...args),
  usarEspecieDelServidor: (...args: unknown[]) => mockUsarEspecieDelServidor(...args),
  mantenerEspecieLocal: (...args: unknown[]) => mockMantenerEspecieLocal(...args),
}));
jest.mock('../../src/utils/avisoBreve', () => ({ avisoBreve: (...args: unknown[]) => mockAvisoBreve(...args) }));

function arbol(cambios: Partial<TreeDetail> = {}): TreeDetail {
  return {
    id: 't1', grupoId: 'g1', especieId: 'e1', posicion: 3, subId: 'P1L1CEI3', fotoUrl: null, fotoSynced: false,
    createdAt: '', latitude: null, longitude: null, gpsAccuracy: null, gpsCapturedAt: null,
    conflictEspecieId: null, conflictEspecieNombre: null,
    especieCodigo: 'CEI', especieNombre: 'Ceibo', especieNombreCientifico: null, plantacionCodigo: 'SS',
    ...cambios,
  };
}

function Pantalla({ tree, cambio, onReabrirGrupo }: {
  tree: TreeDetail; cambio: CambioDeEspecie; onReabrirGrupo: () => Promise<boolean>;
}) {
  const confirm = useConfirm();
  return (
    <>
      <SeccionEspecie tree={tree} plantacionId="p1" cambio={cambio} onReabrirGrupo={onReabrirGrupo} confirmar={confirm.show} />
      <ConfirmModal {...confirm.confirmProps} />
    </>
  );
}

function renderSeccion(cambio: CambioDeEspecie, tree = arbol(), reabre = true) {
  const onReabrirGrupo = jest.fn().mockResolvedValue(reabre);
  return { ...render(<Pantalla tree={tree} cambio={cambio} onReabrirGrupo={onReabrirGrupo} />), onReabrirGrupo };
}

beforeEach(() => jest.clearAllMocks());

describe('SeccionEspecie: cambiar especie', () => {
  it('sin permiso no ofrece el cambio', () => {
    const { queryByText } = renderSeccion('no-disponible');
    expect(queryByText(ETIQUETA_CAMBIAR_ESPECIE)).toBeNull();
  });

  it('abre el buscador con las especies y marca la actual', () => {
    const { getByText, getByPlaceholderText } = renderSeccion('disponible');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    expect(getByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE)).toBeTruthy();
    expect(getByText('Álamo')).toBeTruthy();
    expect(getByText('actual')).toBeTruthy();
  });

  it('busca por nombre científico sin distinguir tildes', () => {
    const { getByText, getByPlaceholderText, getAllByText } = renderSeccion('disponible');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.changeText(getByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE), 'celtis');
    expect(getByText('Tala')).toBeTruthy();
    expect(getAllByText('Ceibo')).toHaveLength(1);
    fireEvent.changeText(getByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE), 'alamo');
    expect(getByText('Álamo')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE), 'zzz');
    expect(getByText(TEXTO_SIN_COINCIDENCIAS)).toBeTruthy();
  });

  it('elegir una especie la aplica sin confirmar y avisa el ID nuevo', async () => {
    mockCambiarEspecie.mockResolvedValue({ subId: 'P1L1ALA3' });
    const { getByText } = renderSeccion('disponible');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.press(getByText('Álamo'));
    await waitFor(() => expect(mockAvisoBreve).toHaveBeenCalledWith('Especie cambiada. Nuevo ID: P1L1ALA3-SS'));
    expect(mockCambiarEspecie).toHaveBeenCalledWith('t1', 'e2');
  });

  it('elegir la actual solo cierra el buscador', () => {
    const { getByText, queryByPlaceholderText, getAllByText } = renderSeccion('disponible');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.press(getAllByText('Ceibo')[1]);
    expect(mockCambiarEspecie).not.toHaveBeenCalled();
    expect(queryByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE)).toBeNull();
  });

  it('si falla avisa', async () => {
    mockCambiarEspecie.mockRejectedValue(new Error('x'));
    const { getByText } = renderSeccion('disponible');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.press(getByText('Tala'));
    await waitFor(() => expect(mockAvisoBreve).toHaveBeenCalledWith('No se pudo cambiar la especie.'));
  });
});

describe('SeccionEspecie: grupo finalizado', () => {
  it('el botón se ve deshabilitado pero responde con el aviso de reabrir', () => {
    const { getByText, getByRole, queryByPlaceholderText } = renderSeccion('requiere-reabrir');
    expect(getByRole('button', { name: new RegExp(ETIQUETA_CAMBIAR_ESPECIE) }).props.accessibilityState)
      .toMatchObject({ disabled: true });
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    expect(getByText(AVISO_REABRIR_GRUPO.titulo)).toBeTruthy();
    expect(getByText(AVISO_REABRIR_GRUPO.mensaje)).toBeTruthy();
    expect(queryByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE)).toBeNull();
  });

  it('cancelar no reabre', () => {
    const { getByText, onReabrirGrupo } = renderSeccion('requiere-reabrir');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.press(getByText('Cancelar'));
    expect(onReabrirGrupo).not.toHaveBeenCalled();
  });

  it('«Reabrir y cambiar» reabre el grupo y abre el buscador', async () => {
    const { getByText, findByPlaceholderText, onReabrirGrupo } = renderSeccion('requiere-reabrir');
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.press(getByText(AVISO_REABRIR_GRUPO.confirmar));
    expect(await findByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE)).toBeTruthy();
    expect(onReabrirGrupo).toHaveBeenCalled();
  });

  it('si no se pudo reabrir, no abre el buscador', async () => {
    const { getByText, queryByPlaceholderText, onReabrirGrupo } = renderSeccion('requiere-reabrir', arbol(), false);
    fireEvent.press(getByText(ETIQUETA_CAMBIAR_ESPECIE));
    fireEvent.press(getByText(AVISO_REABRIR_GRUPO.confirmar));
    await waitFor(() => expect(onReabrirGrupo).toHaveBeenCalled());
    expect(queryByPlaceholderText(PLACEHOLDER_BUSCAR_ESPECIE)).toBeNull();
  });
});

describe('SeccionEspecie: conflicto con el server', () => {
  const enConflicto = arbol({ conflictEspecieId: 'e3', conflictEspecieNombre: 'Tala' });

  it('muestra las dos especies, rotuladas', () => {
    const { getByText } = renderSeccion('disponible', enConflicto);
    expect(getByText(textoConflictoDeEspecie('Tala'))).toBeTruthy();
    expect(getByText(etiquetaEspecieDelServidor('Tala'))).toBeTruthy();
    expect(getByText(etiquetaEspecieLocal('Ceibo'))).toBeTruthy();
  });

  it('elegir la del server', async () => {
    mockUsarEspecieDelServidor.mockResolvedValue(undefined);
    const { getByText } = renderSeccion('disponible', enConflicto);
    fireEvent.press(getByText(etiquetaEspecieDelServidor('Tala')));
    await waitFor(() => expect(mockUsarEspecieDelServidor).toHaveBeenCalledWith('t1'));
  });

  it('mantener la local', async () => {
    mockMantenerEspecieLocal.mockResolvedValue(undefined);
    const { getByText } = renderSeccion('disponible', enConflicto);
    fireEvent.press(getByText(etiquetaEspecieLocal('Ceibo')));
    await waitFor(() => expect(mockMantenerEspecieLocal).toHaveBeenCalledWith('t1'));
  });

  it('sin el nombre de la especie del server, no deja un botón vacío', () => {
    const { getByText } = renderSeccion('disponible', arbol({ conflictEspecieId: 'e9', conflictEspecieNombre: null }));
    expect(getByText(etiquetaEspecieDelServidor(ESPECIE_DESCONOCIDA))).toBeTruthy();
  });

  it('sin permiso, explica la marca sin ofrecer acciones', () => {
    const { getByText, queryByText } = renderSeccion('no-disponible', enConflicto);
    expect(getByText(textoConflictoSoloLectura('Tala'))).toBeTruthy();
    expect(queryByText(etiquetaEspecieDelServidor('Tala'))).toBeNull();
  });

  it('con el grupo finalizado, elegir pasa por reabrirlo', async () => {
    mockUsarEspecieDelServidor.mockResolvedValue(undefined);
    const { getByText, onReabrirGrupo } = renderSeccion('requiere-reabrir', enConflicto);
    fireEvent.press(getByText(etiquetaEspecieDelServidor('Tala')));
    expect(mockUsarEspecieDelServidor).not.toHaveBeenCalled();
    fireEvent.press(getByText(AVISO_REABRIR_GRUPO.confirmar));
    await waitFor(() => expect(mockUsarEspecieDelServidor).toHaveBeenCalledWith('t1'));
    expect(onReabrirGrupo).toHaveBeenCalled();
  });

  it('si no se pudo reabrir, no resuelve', async () => {
    const { getByText, onReabrirGrupo } = renderSeccion('requiere-reabrir', enConflicto, false);
    fireEvent.press(getByText(etiquetaEspecieLocal('Ceibo')));
    fireEvent.press(getByText(AVISO_REABRIR_GRUPO.confirmar));
    await waitFor(() => expect(onReabrirGrupo).toHaveBeenCalled());
    expect(mockMantenerEspecieLocal).not.toHaveBeenCalled();
  });
});
