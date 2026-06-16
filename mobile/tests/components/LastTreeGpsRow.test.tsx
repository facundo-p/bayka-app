// Render tests de la fila de precisión + re-captura del último árbol (#103).

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import LastTreeGpsRow from '../../src/components/LastTreeGpsRow';

const noop = () => {};

describe('LastTreeGpsRow', () => {
  it('con punto: muestra "± X m" y botón Recapturar', () => {
    const { getByText } = render(
      <LastTreeGpsRow hasPoint gpsAccuracy={6.4} recapturing={false} onRecapture={noop} />,
    );
    getByText('± 6 m');
    getByText('Recapturar');
  });

  it('sin punto (no correspondía por frecuencia): ofrece captura manual a demanda', () => {
    const { getByText } = render(
      <LastTreeGpsRow hasPoint={false} gpsAccuracy={null} recapturing={false} onRecapture={noop} />,
    );
    getByText('Sin punto GPS');
    getByText('Capturar');
  });

  it('mientras resuelve: botón deshabilitado (doble tap idempotente)', () => {
    const onRecapture = jest.fn();
    const { getByTestId } = render(
      <LastTreeGpsRow hasPoint gpsAccuracy={3} recapturing onRecapture={onRecapture} />,
    );
    fireEvent.press(getByTestId('recapture-gps-button'));
    expect(onRecapture).not.toHaveBeenCalled();
  });

  it('tap dispara la re-captura', () => {
    const onRecapture = jest.fn();
    const { getByTestId } = render(
      <LastTreeGpsRow hasPoint gpsAccuracy={3} recapturing={false} onRecapture={onRecapture} />,
    );
    fireEvent.press(getByTestId('recapture-gps-button'));
    expect(onRecapture).toHaveBeenCalledTimes(1);
  });
});
