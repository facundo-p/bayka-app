import { render, screen, act } from '@testing-library/react';
import { BP, useMediaQuery } from '../useMediaQuery';
import { simularAncho } from '../../test/simularAncho';

function Sonda({ consulta }: { consulta: string }) {
  return <span>{useMediaQuery(consulta) ? 'sí' : 'no'}</span>;
}

describe('useMediaQuery', () => {
  it('sin matchMedia asume desktop en vez de explotar', () => {
    const original = window.matchMedia;
    // @ts-expect-error se borra a propósito para simular jsdom pelado.
    delete window.matchMedia;
    render(<Sonda consulta={BP.movil} />);
    expect(screen.getByText('no')).toBeInTheDocument();
    window.matchMedia = original;
  });

  it('responde al ancho simulado', () => {
    simularAncho(430);
    render(<Sonda consulta={BP.movil} />);
    expect(screen.getByText('sí')).toBeInTheDocument();
  });

  it('no matchea un escalón más chico que el ancho', () => {
    simularAncho(1024);
    render(<Sonda consulta={BP.movil} />);
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('se re-renderiza al cruzar el umbral', () => {
    // El punto del useSyncExternalStore: sin la suscripción esto no cambia.
    const oyentes = new Set<() => void>();
    let ancho = 1920;
    window.matchMedia = ((consulta: string) => ({
      get matches() {
        const tope = /\(max-width:\s*(\d+)px\)/.exec(consulta);
        return tope ? ancho <= Number(tope[1]) : false;
      },
      media: consulta,
      onchange: null,
      addEventListener: (_: string, cb: () => void) => oyentes.add(cb),
      removeEventListener: (_: string, cb: () => void) => oyentes.delete(cb),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    render(<Sonda consulta={BP.tablet} />);
    expect(screen.getByText('no')).toBeInTheDocument();

    act(() => {
      ancho = 500;
      oyentes.forEach((cb) => cb());
    });
    expect(screen.getByText('sí')).toBeInTheDocument();
  });
});
