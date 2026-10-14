// Las quitadas aplicadas dejan la base sin foto (#816): rechazadas y conservadas no.
import { quitadasAplicadas } from '../../src/services/sync/conservados';

const pendientes = [{ id: 'aplicada' }, { id: 'rechazada' }, { id: 'conservada' }, { id: 'ya-sin-foto' }];
const respuesta = {
  success: true,
  quitadas: 1,
  rechazados: ['rechazada'],
  conservados: { arboles: [{ id: 'conservada', foto_url: 'plantations/p/parcelas/x/trees/conservada-v2.jpg' }] },
};

describe('quitadasAplicadas', () => {
  it('en un lote mixto devuelve solo las que el server quitó, o que ya no tenían foto', () => {
    expect(quitadasAplicadas(pendientes, respuesta, new Set(['rechazada']))).toEqual(['aplicada', 'ya-sin-foto']);
  });

  it('una conservada sin foto en el server tampoco cuenta como aplicada', () => {
    const sinFoto = { conservados: { arboles: [{ id: 'conservada', foto_url: null }] } };
    expect(quitadasAplicadas([{ id: 'conservada' }], sinFoto, new Set())).toEqual([]);
  });

  it('un server sin conservados quitó todas las no rechazadas', () => {
    expect(quitadasAplicadas(pendientes, { success: true }, new Set(['rechazada']))).toEqual(['aplicada', 'conservada', 'ya-sin-foto']);
  });
});
