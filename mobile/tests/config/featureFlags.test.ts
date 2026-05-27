/**
 * featureFlags — trivial guardia contra cambio accidental del default v1.1.
 * Si este test falla por design, actualizar acá Y la JSDoc del flag.
 */
import { AUTO_PARCELA_DEFAULT } from '../../src/config/featureFlags';

describe('featureFlags', () => {
  test('AUTO_PARCELA_DEFAULT default v1.1 = true', () => {
    expect(AUTO_PARCELA_DEFAULT).toBe(true);
  });
});
