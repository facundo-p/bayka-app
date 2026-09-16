import {
  abortarSiCancelado,
  cancelarCorrida,
  esCancelacion,
  estaCancelado,
  iniciarCorrida,
  signalDeCancelacion,
  SyncCanceladoError,
  terminarCorrida,
} from '../../src/services/sync/cancelacion';

describe('cancelacion', () => {
  afterEach(() => terminarCorrida());

  it('sin corrida abierta no hay nada que cancelar', () => {
    expect(estaCancelado()).toBe(false);
    expect(signalDeCancelacion()).toBeUndefined();
    expect(() => abortarSiCancelado()).not.toThrow();
  });

  // Un pull suelto (pull-to-refresh) no abre corrida: `cancelarCorrida` no tiene
  // que explotar por eso.
  it('cancelar sin corrida abierta no rompe', () => {
    expect(() => cancelarCorrida()).not.toThrow();
  });

  it('una corrida recién abierta no está cancelada', () => {
    iniciarCorrida();

    expect(estaCancelado()).toBe(false);
    expect(signalDeCancelacion()?.aborted).toBe(false);
  });

  it('después de cancelar, el próximo borde corta', () => {
    iniciarCorrida();

    cancelarCorrida();

    expect(estaCancelado()).toBe(true);
    expect(() => abortarSiCancelado()).toThrow(SyncCanceladoError);
  });

  it('el signal queda abortado, para matar la request en vuelo', () => {
    iniciarCorrida();

    cancelarCorrida();

    expect(signalDeCancelacion()?.aborted).toBe(true);
  });

  /**
   * Cerrar la corrida es lo que evita que la cancelación quede pegada. Lo que lo
   * revela no es la sync siguiente —esa abre un control nuevo igual— sino una
   * operación que NO abre corrida: un pull-to-refresh arrancaría cortado para
   * siempre.
   */
  it('cerrada la corrida, una operación suelta no arranca cancelada', () => {
    iniciarCorrida();
    cancelarCorrida();

    terminarCorrida();

    expect(estaCancelado()).toBe(false);
    expect(signalDeCancelacion()).toBeUndefined();
    expect(() => abortarSiCancelado()).not.toThrow();
  });

  it('la corrida siguiente arranca limpia', () => {
    iniciarCorrida();
    cancelarCorrida();
    terminarCorrida();

    iniciarCorrida();

    expect(estaCancelado()).toBe(false);
  });

  it('esCancelacion distingue la cancelación de cualquier otro error', () => {
    expect(esCancelacion(new SyncCanceladoError())).toBe(true);
    expect(esCancelacion(new Error('Network request failed'))).toBe(false);
    expect(esCancelacion(null)).toBe(false);
  });
});
