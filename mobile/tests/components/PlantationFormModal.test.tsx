// Formulario de plantación (#633): todos los campos juntos y aviso de duplicado que no frena.

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlantationFormModal from '../../src/components/PlantationFormModal';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const EXISTENTE = {
  id: 'p-1', lugar: 'Lote Norte', periodo: 'Otoño 2026', estado: 'activa', createdAt: '2026-01-01',
  archivadaEn: null, eliminadaEnServidorEn: null,
};

function renderForm(props: Partial<React.ComponentProps<typeof PlantationFormModal>> = {}) {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <PlantationFormModal visible onClose={jest.fn()} onSubmit={onSubmit} plantaciones={[EXISTENTE]} {...props} />,
  );
  return { ...utils, onSubmit };
}

describe('PlantationFormModal', () => {
  it('muestra los ocho campos en un solo formulario', () => {
    const { getByText } = renderForm();
    for (const etiqueta of [
      'Lugar', 'Periodo', 'Fecha de inicio (opcional)', 'Objetivo (árboles)', 'Descripción (opcional)',
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

    fireEvent.press(getByText('Crear'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      lugar: 'lote norte', periodo: 'OTOÑO 2026',
    })));
  });

  it('en edición no se avisa a sí misma y precarga los datos', () => {
    const { queryByText, getByDisplayValue } = renderForm({
      editingPlantation: { ...EXISTENTE, objetivoArboles: 12000, fechaInicio: '2026-04-15' },
    });
    expect(queryByText(/Ya tenés una/)).toBeNull();
    expect(getByDisplayValue('12000')).toBeTruthy();
    expect(getByDisplayValue('15/04/2026')).toBeTruthy();
  });

  it('manda los campos nuevos y bloquea un objetivo inválido', async () => {
    const { getByPlaceholderText, getByText, getByTestId, onSubmit } = renderForm();
    fireEvent.changeText(getByPlaceholderText('Lote Norte'), 'Campo Sur');
    fireEvent.changeText(getByPlaceholderText('Otoño 2026'), '2026');
    fireEvent.changeText(getByPlaceholderText('Opcional'), '0');
    fireEvent.press(getByText('Crear'));
    expect(getByText('El objetivo debe ser un número entero de al menos 1 árbol.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(getByPlaceholderText('Opcional'), '500');
    fireEvent.changeText(getByPlaceholderText('DD/MM/AAAA'), '15042026');
    fireEvent(getByTestId('foto-en-todos-switch'), 'valueChange', true);
    fireEvent(getByTestId('visible-tecnicos-switch'), 'valueChange', false);
    fireEvent.press(getByText('Crear'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      objetivoArboles: 500, fechaInicio: '2026-04-15', photoCaptureAllTrees: true, visibleInApp: false,
    })));
  });
});
