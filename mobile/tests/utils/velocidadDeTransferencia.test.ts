import { formatearVelocidad } from '../../src/utils/velocidadDeTransferencia';

const KB = 1024;
const MB = 1024 * KB;
const ARRANQUE = 1_000_000;
const seg = (n: number) => ARRANQUE + n * 1000;

describe('formatearVelocidad', () => {
  it('muestra KB/s para velocidades de campo', () => {
    expect(formatearVelocidad({ bytes: 180 * KB, desde: ARRANQUE }, seg(1))).toBe('~180 KB/s');
  });

  it('pasa a MB/s cuando el número en KB dejaría de leerse', () => {
    expect(formatearVelocidad({ bytes: 5 * MB, desde: ARRANQUE }, seg(2))).toBe('~2.5 MB/s');
  });

  it('exactamente 1 MB/s ya se muestra en MB', () => {
    expect(formatearVelocidad({ bytes: MB, desde: ARRANQUE }, seg(1))).toBe('~1.0 MB/s');
  });

  // Un "0 KB/s" redondeado parece "no avanza", que es justo lo contrario de lo que
  // el indicador viene a responder.
  it('una conexión muy lenta no se muestra como 0', () => {
    expect(formatearVelocidad({ bytes: 300, desde: ARRANQUE }, seg(1))).toBe('~<1 KB/s');
  });

  describe('no muestra nada cuando no hay con qué calcular', () => {
    it('sin ninguna foto completa todavía', () => {
      expect(formatearVelocidad({ bytes: 0, desde: ARRANQUE }, seg(5))).toBeNull();
    });

    it('sin bytes informados (el driver no los expone)', () => {
      expect(formatearVelocidad({ desde: ARRANQUE }, seg(5))).toBeNull();
    });

    it('sin marca de arranque', () => {
      expect(formatearVelocidad({ bytes: 5 * MB }, seg(5))).toBeNull();
    });

    // La primera foto puede completarse dentro del mismo milisegundo en un test o
    // con caché: sin el guard sale Infinity.
    it('con tiempo transcurrido cero', () => {
      expect(formatearVelocidad({ bytes: 5 * MB, desde: ARRANQUE }, ARRANQUE)).toBeNull();
    });

    it('con el reloj corrido hacia atrás', () => {
      expect(formatearVelocidad({ bytes: 5 * MB, desde: ARRANQUE }, ARRANQUE - 5000)).toBeNull();
    });
  });

  it('nunca devuelve NaN ni Infinity', () => {
    const casos = [
      { bytes: NaN, desde: ARRANQUE },
      { bytes: Infinity, desde: ARRANQUE },
      { bytes: 5 * MB, desde: NaN },
    ];

    for (const caso of casos) {
      const salida = formatearVelocidad(caso, seg(1));
      expect(salida === null || (!salida.includes('NaN') && !salida.includes('Infinity'))).toBe(true);
    }
  });
});
