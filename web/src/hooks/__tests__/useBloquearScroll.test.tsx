import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { afterEach, vi } from 'vitest';
import { Modal } from '../../components/Modal';
import { ATRIBUTO_SCROLL_BLOQUEADO, MARCA_SCROLL_BLOQUEADO } from '../useBloquearScroll';

const raiz = document.documentElement;
const marca = () => raiz.getAttribute(ATRIBUTO_SCROLL_BLOQUEADO);

/** Dos modales independientes, como la hoja de detalle y una confirmación abierta desde ella. */
function Dos({ a, b }: { a: boolean; b: boolean }) {
  return (
    <>
      <Modal open={a} title="Hoja" onClose={() => {}}>
        <p>hoja</p>
      </Modal>
      <Modal open={b} title="Confirmar" onClose={() => {}}>
        <p>confirmar</p>
      </Modal>
    </>
  );
}

/** jsdom no scrollea: la posición del documento la lleva el test. */
function simularScrollDocumento(inicial: number) {
  let posicion = inicial;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => posicion });
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation((destino) => {
    posicion = (destino as ScrollToOptions).top ?? posicion;
  });
  return { arrastrarA: (y: number) => (posicion = y), posicion: () => posicion, scrollTo };
}

function simularAnchoUtil(clientWidth: number) {
  Object.defineProperty(raiz, 'clientWidth', { configurable: true, value: clientWidth });
}

const URL_INICIAL = window.location.href;

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', URL_INICIAL);
  Reflect.deleteProperty(window, 'scrollY');
  Reflect.deleteProperty(raiz, 'clientWidth');
});

test('abierto bloquea el scroll del documento y cerrado lo libera', () => {
  const { rerender } = render(<Dos a={false} b={false} />);
  expect(marca()).toBeNull();

  rerender(<Dos a b={false} />);
  expect(marca()).not.toBeNull();

  rerender(<Dos a={false} b={false} />);
  expect(marca()).toBeNull();
});

test('con modales anidados se libera recién al cerrar el último, en cualquier orden', () => {
  const { rerender } = render(<Dos a b={false} />);
  rerender(<Dos a b />);

  rerender(<Dos a={false} b />);
  expect(marca()).not.toBeNull();

  rerender(<Dos a={false} b={false} />);
  expect(marca()).toBeNull();
});

test('al cerrar el último, la lista vuelve a la posición en que estaba al abrir', () => {
  const scroll = simularScrollDocumento(200);
  const { rerender } = render(<Dos a b={false} />);
  rerender(<Dos a b />);

  // Un navegador que no respete el overflow igual puede moverla mientras tanto.
  scroll.arrastrarA(321);
  rerender(<Dos a={false} b />);
  expect(scroll.scrollTo).not.toHaveBeenCalled();

  rerender(<Dos a={false} b={false} />);
  expect(scroll.posicion()).toBe(200);
});

test('si la lista no se movió, cerrar no la toca', () => {
  const scroll = simularScrollDocumento(200);
  const { rerender } = render(<Dos a b={false} />);
  rerender(<Dos a={false} b={false} />);
  expect(scroll.scrollTo).not.toHaveBeenCalled();
});

test('si se cerró por un «atrás», no pisa el scroll que restauró el navegador', () => {
  const scroll = simularScrollDocumento(200);
  const { rerender } = render(<Dos a b={false} />);

  window.history.pushState(null, '', '/otra-pantalla');
  scroll.arrastrarA(40);
  rerender(<Dos a={false} b={false} />);

  expect(scroll.scrollTo).not.toHaveBeenCalled();
  expect(scroll.posicion()).toBe(40);
});

test('desmontar con el modal abierto lo libera', () => {
  const { unmount } = render(<Dos a b />);
  unmount();
  expect(marca()).toBeNull();
});

test('en StrictMode los efectos dobles no desfasan la cuenta', () => {
  const enStrict = (a: boolean, b: boolean) => (
    <StrictMode>
      <Dos a={a} b={b} />
    </StrictMode>
  );
  const { rerender } = render(enStrict(true, false));
  rerender(enStrict(true, true));

  rerender(enStrict(true, false));
  expect(marca()).not.toBeNull();

  rerender(enStrict(false, false));
  expect(marca()).toBeNull();
});

test.each([
  ['había barra de scroll clásica', 1009, MARCA_SCROLL_BLOQUEADO.conBarra],
  ['la barra no ocupa lugar (teléfono, macOS)', 1024, MARCA_SCROLL_BLOQUEADO.sinBarra],
])('reserva el lugar de la barra solo si %s', (_caso, clientWidth, esperada) => {
  simularAnchoUtil(clientWidth);
  render(<Dos a b={false} />);
  expect(marca()).toBe(esperada);
});

test('el bloqueo no toca nada debajo de <html>: el scroll de adentro sigue andando', () => {
  render(<Dos a b={false} />);
  const dialogo = document.querySelector('[role=dialog]')!;
  const sinCancelar = dialogo.dispatchEvent(
    new TouchEvent('touchmove', { bubbles: true, cancelable: true }),
  );
  expect(sinCancelar).toBe(true);
  expect(document.body.getAttribute('style')).toBeNull();
  expect(dialogo.getAttribute('style')).toBeNull();
});

describe('contrato con theme.css', () => {
  const css = readFileSync(join(process.cwd(), 'src/theme/theme.css'), 'utf8');
  const regla = (selector: string) => {
    const inicio = css.indexOf(`${selector} {`);
    return inicio === -1 ? null : css.slice(inicio, css.indexOf('}', inicio));
  };

  test('la marca en <html> corta el scroll del documento y el pull-to-refresh', () => {
    const bloqueada = regla(`:root[${ATRIBUTO_SCROLL_BLOQUEADO}]`);
    expect(bloqueada).toMatch(/overflow:\s*hidden/);
    expect(bloqueada).toMatch(/overscroll-behavior:\s*none/);
  });

  test('con barra clásica, su lugar queda reservado', () => {
    const selector = `:root[${ATRIBUTO_SCROLL_BLOQUEADO}='${MARCA_SCROLL_BLOQUEADO.conBarra}']`;
    expect(regla(selector)).toMatch(/scrollbar-gutter:\s*stable/);
  });
});
