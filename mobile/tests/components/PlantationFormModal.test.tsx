// Formulario de plantación (#633): todos los campos juntos y aviso de duplicado que no frena.

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import PlantationFormModal from '../../src/components/PlantationFormModal';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const EXISTENTE = {
  id: 'p-1', lugar: 'Lote Norte', periodo: 'Otoño 2026', codigo: 'LN26', estado: 'activa', createdAt: '2026-01-01',
  archivadaEn: null, eliminadaEnServidorEn: null,
};

function elegirEnCalendario(fecha: Date) {
  const { onChange } = (DateTimePickerAndroid.open as jest.Mock).mock.calls.at(-1)[0];
  act(() => onChange({ type: 'set', nativeEvent: { timestamp: fecha.getTime() } }, fecha));
}

function renderForm(props: Partial<React.ComponentProps<typeof PlantationFormModal>> = {}) {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <PlantationFormModal visible onClose={jest.fn()} onSubmit={onSubmit} plantaciones={[EXISTENTE]} {...props} />,
  );
  return { ...utils, onSubmit };
}

describe('PlantationFormModal', () => {
  it('muestra los nueve campos en un solo formulario', () => {
    const { getByText } = renderForm();
    for (const etiqueta of [
      'Lugar', 'Periodo', 'Código', 'Fecha de inicio (opcional)', 'Objetivo (árboles)', 'Descripción (opcional)',
      'Captura GPS obligatoria', 'Capturar GPS cada N árboles', 'Foto en todos los botones', 'Visible para técnicos',
    ]) {
      expect(getByText(etiqueta)).toBeTruthy();
    }
  });

  it('avisa el duplicado mientras se escribe y deja crear igual', async () => {
    const { getByPlaceholderText, getByText, queryByText, onSubmit } = renderForm();
    fireEvent.changeText(getByPlaceholderText('Lote Norte'), 'lote norte ');
    expect(queryByText('Ya tenés una "Lote Norte · Otoño 2026"')).toBeNull();

    fireEvent.changeText(getByPlaceholderText('Otoño 2026'), 'OTOÑO 2026');
    expect(getByText('Ya tenés una "Lote Norte · Otoño 2026"')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('SS26-1'), 'LN26-B');

    fireEvent.press(getByText('Crear'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      lugar: 'lote norte', periodo: 'OTOÑO 2026',
    })));
  });

  it('en edición no se avisa a sí misma y precarga los datos', () => {
    const { queryByText, getByDisplayValue, getByText } = renderForm({
      editingPlantation: { ...EXISTENTE, objetivoArboles: 12000, fechaInicio: '2026-04-15' },
    });
    expect(queryByText(/Ya tenés una/)).toBeNull();
    expect(getByDisplayValue('12000')).toBeTruthy();
    expect(getByText('15/04/2026')).toBeTruthy();
  });

  it('en edición cambia la fecha con el calendario', async () => {
    const { getByTestId, getByText, onSubmit } = renderForm({ editingPlantation: { ...EXISTENTE, fechaInicio: '2026-04-15' } });
    fireEvent.press(getByTestId('fecha-inicio'));
    elegirEnCalendario(new Date(2026, 4, 1, 21, 0));
    fireEvent.press(getByText('Guardar'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fechaInicio: '2026-05-01' })));
  });

  it('en edición la ✕ borra la fecha', async () => {
    const { getByLabelText, getByText, onSubmit } = renderForm({ editingPlantation: { ...EXISTENTE, fechaInicio: '2026-04-15' } });
    fireEvent.press(getByLabelText('Borrar fecha'));
    fireEvent.press(getByText('Guardar'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fechaInicio: null })));
  });

  it('manda los campos nuevos y bloquea un objetivo inválido', async () => {
    const { getByPlaceholderText, getByText, getByTestId, onSubmit } = renderForm();
    fireEvent.changeText(getByPlaceholderText('Lote Norte'), 'Campo Sur');
    fireEvent.changeText(getByPlaceholderText('Otoño 2026'), '2026');
    fireEvent.changeText(getByPlaceholderText('SS26-1'), 'CS26');
    fireEvent.changeText(getByPlaceholderText('Opcional'), '0');
    fireEvent.press(getByText('Crear'));
    expect(getByText('El objetivo debe ser un número entero entre 1 y 10.000.000 árboles.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(getByPlaceholderText('Opcional'), '500');
    fireEvent.press(getByTestId('fecha-inicio'));
    elegirEnCalendario(new Date(2026, 3, 15));
    fireEvent(getByTestId('foto-en-todos-switch'), 'valueChange', true);
    fireEvent(getByTestId('visible-tecnicos-switch'), 'valueChange', false);
    fireEvent.press(getByText('Crear'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      objetivoArboles: 500, fechaInicio: '2026-04-15', photoCaptureAllTrees: true, visibleInApp: false,
    })));
  });

  describe('código (#559)', () => {
    function completarLugarYPeriodo(getByPlaceholderText: (texto: string) => any) {
      fireEvent.changeText(getByPlaceholderText('Lote Norte'), 'Campo Sur');
      fireEvent.changeText(getByPlaceholderText('Otoño 2026'), '2026');
    }

    it('se escribe en mayúsculas y sin espacios, y sube así', async () => {
      const { getByPlaceholderText, getByDisplayValue, getByText, onSubmit } = renderForm();
      completarLugarYPeriodo(getByPlaceholderText);
      fireEvent.changeText(getByPlaceholderText('SS26-1'), 'cs 26-b');
      expect(getByDisplayValue('CS26-B')).toBeTruthy();
      fireEvent.press(getByText('Crear'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'CS26-B' })));
    });

    it('es obligatorio al crear', () => {
      const { getByPlaceholderText, getByText, onSubmit } = renderForm();
      completarLugarYPeriodo(getByPlaceholderText);
      fireEvent.press(getByText('Crear'));
      expect(getByText('El código es obligatorio.')).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('no deja crear con el código de otra plantación del dispositivo', () => {
      const { getByPlaceholderText, getAllByText, getByText, onSubmit } = renderForm();
      completarLugarYPeriodo(getByPlaceholderText);
      fireEvent.changeText(getByPlaceholderText('SS26-1'), 'ln26');
      expect(getAllByText('Ya existe otra plantación con ese código.')).toHaveLength(1);
      fireEvent.press(getByText('Crear'));
      expect(getAllByText('Ya existe otra plantación con ese código.')).toHaveLength(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('en edición conserva el suyo sin avisarse a sí misma', async () => {
      const { queryByText, getByText, onSubmit } = renderForm({ editingPlantation: EXISTENTE });
      expect(queryByText('Ya existe otra plantación con ese código.')).toBeNull();
      fireEvent.press(getByText('Guardar'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'LN26' })));
    });

    it('una plantación subida que todavía no bajó su código no lo pide', async () => {
      const { getByPlaceholderText, getByText, onSubmit } = renderForm({
        editingPlantation: { ...EXISTENTE, codigo: null, pendingSync: false },
      });
      expect(getByPlaceholderText('SS26-1').props.editable).toBe(false);
      expect(getByText('Llega del servidor en la próxima sincronización.')).toBeTruthy();
      fireEvent.press(getByText('Guardar'));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    });
  });
});
