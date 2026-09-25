// Campo de fecha con el calendario nativo de Android (#646).

import React, { useState } from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import CampoFecha from '../../src/components/CampoFecha';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const open = DateTimePickerAndroid.open as jest.Mock;

function Controlado({ inicial = '', editable = true, onChange = jest.fn() }) {
  const [valor, setValor] = useState(inicial);
  return (
    <CampoFecha
      testID="fecha"
      label="Fecha"
      value={valor}
      onChange={(iso) => { onChange(iso); setValor(iso); }}
      placeholder="DD/MM/AAAA"
      editable={editable}
    />
  );
}

/** Responde al diálogo abierto como lo haría Android. */
function responder(type: string, fecha?: Date) {
  const { onChange } = open.mock.calls.at(-1)[0];
  act(() => onChange({ type, nativeEvent: { timestamp: fecha?.getTime() } }, fecha));
}

beforeEach(() => open.mockClear());

describe('CampoFecha', () => {
  it('vacío muestra el placeholder y abre el calendario en modo fecha, en el día de hoy', () => {
    const { getByTestId, getByText } = render(<Controlado />);
    expect(getByText('DD/MM/AAAA')).toBeTruthy();
    fireEvent.press(getByTestId('fecha'));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ mode: 'date' }));
    const hoy = new Date();
    expect(open.mock.calls[0][0].value.toDateString()).toBe(hoy.toDateString());
  });

  it('elegir una fecha la muestra en DD/MM/AAAA y la entrega como YYYY-MM-DD', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = render(<Controlado onChange={onChange} />);
    fireEvent.press(getByTestId('fecha'));
    responder('set', new Date(2026, 2, 15, 23, 30));
    expect(onChange).toHaveBeenCalledWith('2026-03-15');
    expect(getByText('15/03/2026')).toBeTruthy();
  });

  it('cancelar el diálogo no cambia la fecha', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = render(<Controlado inicial="2026-04-15" onChange={onChange} />);
    fireEvent.press(getByTestId('fecha'));
    responder('dismissed');
    expect(onChange).not.toHaveBeenCalled();
    expect(getByText('15/04/2026')).toBeTruthy();
  });

  it('con fecha, el calendario abre en esa fecha', () => {
    const { getByTestId } = render(<Controlado inicial="2026-04-15" />);
    fireEvent.press(getByTestId('fecha'));
    const valor: Date = open.mock.calls[0][0].value;
    expect([valor.getFullYear(), valor.getMonth(), valor.getDate()]).toEqual([2026, 3, 15]);
  });

  it('la ✕ vacía el campo sin abrir el calendario', () => {
    const onChange = jest.fn();
    const { getByLabelText, getByText, queryByLabelText } = render(<Controlado inicial="2026-04-15" onChange={onChange} />);
    fireEvent.press(getByLabelText('Borrar fecha'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(open).not.toHaveBeenCalled();
    expect(getByText('DD/MM/AAAA')).toBeTruthy();
    expect(queryByLabelText('Borrar fecha')).toBeNull();
  });

  it('no editable no abre el calendario ni borra', () => {
    const onChange = jest.fn();
    const { getByTestId, getByLabelText } = render(<Controlado inicial="2026-04-15" editable={false} onChange={onChange} />);
    fireEvent.press(getByTestId('fecha'));
    fireEvent.press(getByLabelText('Borrar fecha'));
    expect(open).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
