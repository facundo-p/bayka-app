import { render, screen, act } from '@testing-library/react';
import { BP, useMediaQuery, type Breakpoint } from '../useMediaQuery';
import { ANCHO, simularAncho } from '../../test/simularAncho';

function Sonda({ consulta }: { consulta: Breakpoint }) {
  return <span>{useMediaQuery(consulta) ? 'sí' : 'no'}</span>;
}

describe('useMediaQuery', () => {
  it('sin matchMedia asume desktop en vez de explotar', () => {
    // @ts-expect-error se borra a propósito para simular jsdom pelado.
    delete window.matchMedia;
    render(<Sonda consulta={BP.movil} />);
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('responde al ancho simulado', () => {
    simularAncho(ANCHO.movil);
    render(<Sonda consulta={BP.movil} />);
    expect(screen.getByText('sí')).toBeInTheDocument();
  });

  it('no matchea un escalón más chico que el ancho', () => {
    simularAncho(ANCHO.tablet);
    render(<Sonda consulta={BP.movil} />);
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('se re-renderiza al cruzar el umbral', () => {
    // El punto del useSyncExternalStore: sin la suscripción esto no cambia.
    simularAncho(ANCHO.desktop);
    render(<Sonda consulta={BP.tablet} />);
    expect(screen.getByText('no')).toBeInTheDocument();

    act(() => simularAncho(ANCHO.movil));
    expect(screen.getByText('sí')).toBeInTheDocument();
  });
});

// El orden importa a propósito: cada caso hereda lo que dejó el anterior.
describe('el stub de matchMedia vuelve a desktop entre tests', () => {
  it('un test deja la ventana chica', () => {
    simularAncho(ANCHO.movil);
    expect(window.matchMedia(BP.movil).matches).toBe(true);
  });

  it('el siguiente arranca en desktop', () => {
    expect(window.matchMedia(BP.movil).matches).toBe(false);
  });

  it('un test borra matchMedia', () => {
    // @ts-expect-error se borra a propósito para simular jsdom pelado.
    delete window.matchMedia;
    expect(window.matchMedia).toBeUndefined();
  });

  it('el siguiente lo tiene de vuelta', () => {
    expect(window.matchMedia(BP.tablet).matches).toBe(false);
  });
});
