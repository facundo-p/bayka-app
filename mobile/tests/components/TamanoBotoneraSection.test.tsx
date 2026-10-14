// Sección «Tamaño de la botonera» de Opciones (#744).
import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import TamanoBotoneraSection from '../../src/components/TamanoBotoneraSection';
import type { EstiloBotonera } from '../../src/constants/estiloBotonera';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const ORIGINAL: EstiloBotonera = { orden: 'codigo-arriba', tamanoCodigo: 18, tamanoNombre: 11 };

const especie = (codigo: string, nombre: string) => ({
  id: codigo, plantacionId: 'p1', especieId: codigo, codigo, nombre, nombreCientifico: null, ordenVisual: 0,
});
const ESPECIES = [especie('LAP', 'Lapacho rosado'), especie('TIM', 'Timbó'), especie('CED', 'Cedro misionero')];

function renderSeccion(estilo: EstiloBotonera, especies = ESPECIES) {
  const onChange = jest.fn();
  const utils = render(<TamanoBotoneraSection estilo={estilo} especies={especies} onChange={onChange} />);
  return { ...utils, onChange };
}

describe('TamanoBotoneraSection', () => {
  it('sube y baja los tamaños de a uno', () => {
    const { getByTestId, onChange } = renderSeccion(ORIGINAL);
    fireEvent.press(getByTestId('tamano-codigo-mas'));
    expect(onChange).toHaveBeenLastCalledWith({ ...ORIGINAL, tamanoCodigo: 19 });
    fireEvent.press(getByTestId('tamano-nombre-menos'));
    expect(onChange).toHaveBeenLastCalledWith({ ...ORIGINAL, tamanoNombre: 10 });
  });

  it('en los extremos del rango deshabilita el botón que se pasaría', () => {
    const { getByTestId, onChange } = renderSeccion({ ...ORIGINAL, tamanoCodigo: 24, tamanoNombre: 9 });
    fireEvent.press(getByTestId('tamano-codigo-mas'));
    fireEvent.press(getByTestId('tamano-nombre-menos'));
    expect(onChange).not.toHaveBeenCalled();
    expect(getByTestId('tamano-codigo-mas').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('cambia el orden', () => {
    const { getByText, onChange } = renderSeccion(ORIGINAL);
    fireEvent.press(getByText('Nombre arriba'));
    expect(onChange).toHaveBeenCalledWith({ ...ORIGINAL, orden: 'nombre-arriba' });
  });

  it('Restablecer vuelve al diseño original y está deshabilitado si ya lo es', () => {
    const cambiado = renderSeccion({ orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 });
    fireEvent.press(cambiado.getByTestId('restablecer-botonera'));
    expect(cambiado.onChange).toHaveBeenCalledWith(ORIGINAL);
    cambiado.unmount();

    const original = renderSeccion(ORIGINAL);
    fireEvent.press(original.getByTestId('restablecer-botonera'));
    expect(original.onChange).not.toHaveBeenCalled();
  });

  it('la vista previa muestra la especie de nombre más corto y la de nombre más largo', () => {
    const { getByTestId } = renderSeccion(ORIGINAL);
    const vista = within(getByTestId('vista-previa-botonera'));
    expect(vista.getByText('Timbó')).toBeTruthy();
    expect(vista.getByText('Cedro misionero')).toBeTruthy();
    expect(vista.queryByText('Lapacho rosado')).toBeNull();
    expect(vista.queryByText('N/N')).toBeNull();
  });

  it('con una sola especie, la vista previa completa con el N/N', () => {
    const { getByTestId } = renderSeccion(ORIGINAL, [especie('TIM', 'Timbó')]);
    const vista = within(getByTestId('vista-previa-botonera'));
    expect(vista.getByText('Timbó')).toBeTruthy();
    expect(vista.getByText('N/N')).toBeTruthy();
  });
});
