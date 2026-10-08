import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TarjetaDeConflicto from '../../src/components/TarjetaDeConflicto';
import type { ConflictoDeCampo } from '../../src/utils/conflictosDeEdicion';
import { vistaDeConflictoDeCampo } from '../../src/utils/textoDeConflicto';
import type { VistaDeConflicto } from '../../src/utils/vistaDeConflicto';

const mockDescargarEnCola = jest.fn();
const mockDescarga = { descargar: jest.fn(), descargarEnCola: mockDescargarEnCola, descargando: false, fallo: false };
jest.mock('../../src/hooks/useDescargarFoto', () => ({ useDescargarFoto: () => mockDescarga }));

const CONFLICTO: ConflictoDeCampo = {
  campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000,
  editadoPor: 'Ana', editadoEn: null, mioEn: null,
};

describe('TarjetaDeConflicto', () => {
  it('muestra los dos cambios y el valor anterior, y elegir avisa cuál', () => {
    const onElegir = jest.fn();
    const { getByText, getByLabelText } = render(
      <TarjetaDeConflicto vista={vistaDeConflictoDeCampo(CONFLICTO)} eleccion="mio" onElegir={onElegir} />,
    );

    expect(getByText('Objetivo de árboles')).toBeTruthy();
    expect(getByText('Antes de los dos cambios: 12.000')).toBeTruthy();
    expect(getByLabelText('Tu cambio · este teléfono: 15.000').props.accessibilityState).toEqual({ checked: true, disabled: false });

    fireEvent.press(getByLabelText('En la web · Ana: 12.500'));

    expect(onElegir).toHaveBeenCalledWith('web');
  });

  it('sin poder conservar lo propio, esa opción queda deshabilitada, gana la del servidor y se ve el motivo', () => {
    const onElegir = jest.fn();
    const vista: VistaDeConflicto = {
      titulo: 'Especie',
      mio: { origen: 'En este teléfono · no disponible', valor: 'Eucalyptus grandis (EG)' },
      otro: { origen: 'En el servidor', valor: 'Pinus taeda (PT)' },
      motivo: 'Tu especie ya no está en la plantación.',
    };
    const { getByText, getByLabelText, queryAllByTestId } = render(
      <TarjetaDeConflicto vista={vista} eleccion="mio" onElegir={onElegir} />,
    );

    const propia = getByLabelText('En este teléfono · no disponible: Eucalyptus grandis (EG). Tu especie ya no está en la plantación.');
    expect(propia.props.accessibilityState).toEqual({ checked: false, disabled: true });
    expect(queryAllByTestId('radio')).toHaveLength(1);
    expect(getByLabelText('En el servidor: Pinus taeda (PT)').props.accessibilityState.checked).toBe(true);
    expect(getByText('Tu especie ya no está en la plantación.')).toBeTruthy();

    fireEvent.press(propia);
    expect(onElegir).not.toHaveBeenCalled();
  });

  const fotos = (enLinea: boolean): VistaDeConflicto => ({
    titulo: 'Foto',
    mio: { origen: 'En este teléfono', valor: '', foto: { treeId: 't1', uri: 'file:///mia.jpg', enLinea, descripcion: 'Foto sacada en este teléfono' } },
    otro: { origen: 'En el servidor', valor: '', foto: { treeId: 't1', uri: 'plantations/p/trees/t1.jpg', enLinea, descripcion: 'Foto del servidor' } },
    advertencia: 'Si queda la del servidor, la foto sacada en este teléfono se borra.',
  });

  it('la foto del servidor sin bajar y sin conexión se ve como placeholder, sin intentar bajarla', () => {
    const { getByText, getByLabelText } = render(<TarjetaDeConflicto vista={fotos(false)} eleccion="mio" onElegir={jest.fn()} />);

    expect(getByText('Se ve cuando haya conexión')).toBeTruthy();
    expect(getByLabelText('Foto sacada en este teléfono')).toBeTruthy();
    expect(mockDescargarEnCola).not.toHaveBeenCalled();
  });

  it('con conexión, la foto del servidor se baja sola y mientras tanto ocupa el lugar de la miniatura', () => {
    const { getByTestId, getByLabelText, queryByText } = render(
      <TarjetaDeConflicto vista={fotos(true)} eleccion="mio" onElegir={jest.fn()} />,
    );

    expect(mockDescargarEnCola).toHaveBeenCalledTimes(1);
    expect(getByTestId('foto-descargando')).toBeTruthy();
    expect(getByLabelText('Foto del servidor, bajando')).toBeTruthy();
    expect(queryByText('Descargar')).toBeNull();
  });

  it('lo que se pierde al guardar se ve como advertencia, y el aviso de un guardado fallido también', () => {
    const vista = { ...fotos(false), aviso: 'No se pudo guardar esta elección. Probá de nuevo.' };
    const { getByTestId, getByText } = render(<TarjetaDeConflicto vista={vista} eleccion="mio" onElegir={jest.fn()} />);

    expect(getByTestId('advertencia-de-conflicto')).toBeTruthy();
    expect(getByText('Si queda la del servidor, la foto sacada en este teléfono se borra.')).toBeTruthy();
    expect(getByText('No se pudo guardar esta elección. Probá de nuevo.')).toBeTruthy();
  });
});
