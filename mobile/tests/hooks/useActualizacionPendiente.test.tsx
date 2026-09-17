/**
 * El aviso de OTA listo depende de este hook (#460). `useUpdates` de expo-updates
 * toma el estado en el render y se suscribe recién en un efecto, sin releerlo: un
 * update que termina en ese hueco no llega nunca a la pantalla.
 *
 * Usa el emitter real de expo-updates; solo el módulo nativo es el mock de jest-expo.
 */
import { useLayoutEffect } from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  emitTestStateChangeEvent,
  resetLatestContext,
  type UpdatesNativeStateMachineContext,
} from 'expo-updates';

import { useActualizacionPendiente } from '../../src/hooks/useActualizacionPendiente';

const CONTEXTO_BASE: UpdatesNativeStateMachineContext = {
  isStartupProcedureRunning: true,
  isUpdateAvailable: true,
  isUpdatePending: false,
  isChecking: false,
  isDownloading: false,
  isRestarting: false,
  restartCount: 0,
  sequenceNumber: 0,
  downloadProgress: 0,
};

let secuencia = 0;

/** Lo que manda el nativo al cambiar de estado; expo-updates descarta eventos fuera de orden. */
function emitirEstado(isUpdatePending: boolean) {
  secuencia += 1;
  emitTestStateChangeEvent({
    context: { ...CONTEXTO_BASE, isUpdatePending, sequenceNumber: secuencia },
  });
}

function Sonda() {
  return <Text>{useActualizacionPendiente() ? 'pendiente' : 'al día'}</Text>;
}

beforeEach(() => {
  resetLatestContext();
  secuencia = 0;
});

describe('useActualizacionPendiente', () => {
  it('pasa a true cuando el nativo avisa que terminó la descarga', () => {
    render(<Sonda />);
    expect(screen.getByText('al día')).toBeTruthy();

    act(() => emitirEstado(true));

    expect(screen.getByText('pendiente')).toBeTruthy();
  });

  it('arranca en true si la descarga terminó antes de montar', () => {
    emitirEstado(true);

    render(<Sonda />);

    expect(screen.getByText('pendiente')).toBeTruthy();
  });

  // El caso de #460: el evento cae después del render y antes de la suscripción.
  // Un `useLayoutEffect` de un hijo corre justo en ese hueco.
  it('no pierde una descarga que termina entre el render y la suscripción', () => {
    function EventoEnElHueco() {
      useLayoutEffect(() => emitirEstado(true), []);
      return null;
    }

    render(
      <>
        <Sonda />
        <EventoEnElHueco />
      </>,
    );

    expect(screen.getByText('pendiente')).toBeTruthy();
  });
});
