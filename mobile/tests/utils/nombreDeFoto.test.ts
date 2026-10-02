import { nombreDeFoto } from '../../src/utils/nombreDeFoto';
import { mensajeDeFoto } from '../../src/utils/mensajeDeFoto';

describe('nombreDeFoto', () => {
  it('arma foto-<lugar>-<periodo>-<subId>.jpg pasado por slug', () => {
    expect(nombreDeFoto('Finca "El Álamo"', '2026', 'A-12')).toBe('foto-finca-el-alamo-2026-a-12.jpg');
  });

  it('omite partes que quedan vacías tras el slug', () => {
    expect(nombreDeFoto('???', '2026', 'x1')).toBe('foto-2026-x1.jpg');
  });
});

describe('mensajeDeFoto', () => {
  it('textos que ve el usuario', () => {
    expect(mensajeDeFoto('guardada')).toBe('Guardada en el álbum Bayka');
    expect(mensajeDeFoto('sin-permiso')).toBe(
      'Sin permiso para guardar en la galería. Activalo en Ajustes del teléfono.',
    );
    expect(mensajeDeFoto('sin-conexion')).toMatch(/^Sin conexión/);
    expect(mensajeDeFoto('compartida')).toBeNull();
  });
});
