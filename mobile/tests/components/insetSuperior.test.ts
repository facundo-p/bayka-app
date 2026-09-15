/**
 * El inset de la status bar lo aplica un solo elemento de la pila superior. Si lo
 * aplican dos queda una franja vacía; si no lo aplica ninguno el contenido se
 * pega a la barra de notificaciones.
 */
import {
  OCUPANTE_DEL_INSET,
  ocupanteDelInsetSuperior,
} from '../../src/components/insetSuperior';

describe('ocupanteDelInsetSuperior', () => {
  it('sin franjas arriba lo ocupa el header', () => {
    expect(ocupanteDelInsetSuperior(false, false)).toBe(OCUPANTE_DEL_INSET.header);
  });

  it('con el aviso de actualización lo ocupa el aviso, no el header', () => {
    expect(ocupanteDelInsetSuperior(false, true)).toBe(OCUPANTE_DEL_INSET.aviso);
  });

  it('en la app TEST lo ocupa la franja de entorno', () => {
    expect(ocupanteDelInsetSuperior(true, false)).toBe(OCUPANTE_DEL_INSET.entorno);
  });

  it('con las dos franjas gana la de entorno, que va más arriba', () => {
    expect(ocupanteDelInsetSuperior(true, true)).toBe(OCUPANTE_DEL_INSET.entorno);
  });
});
