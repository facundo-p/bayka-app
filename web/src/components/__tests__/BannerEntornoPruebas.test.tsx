import { render, screen } from '@testing-library/react';
import { BannerEntornoPruebas } from '../BannerEntornoPruebas';

const mockEntorno = vi.hoisted(() => ({ ES_ENTORNO_DE_PRUEBAS: true, VERSION_APP: 'v1.1.0' }));
vi.mock('../../lib/entorno', () => mockEntorno);

describe('BannerEntornoPruebas', () => {
  beforeEach(() => {
    mockEntorno.ES_ENTORNO_DE_PRUEBAS = true;
  });

  afterEach(() => {
    delete document.documentElement.dataset.entorno;
  });

  it('en staging muestra el aviso con la versión', () => {
    render(<BannerEntornoPruebas />);
    expect(screen.getByText('ENTORNO DE PRUEBAS · v1.1.0')).toBeInTheDocument();
  });

  it('marca <html data-entorno="pruebas"> para que sidebar y Topbar se corran', () => {
    render(<BannerEntornoPruebas />);
    expect(document.documentElement.dataset.entorno).toBe('pruebas');
  });

  it('al desmontarse saca la marca del documento', () => {
    const { unmount } = render(<BannerEntornoPruebas />);
    unmount();
    expect(document.documentElement.dataset.entorno).toBeUndefined();
  });

  it('en producción no renderiza nada ni marca el documento', () => {
    mockEntorno.ES_ENTORNO_DE_PRUEBAS = false;
    const { container } = render(<BannerEntornoPruebas />);
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.dataset.entorno).toBeUndefined();
  });
});
