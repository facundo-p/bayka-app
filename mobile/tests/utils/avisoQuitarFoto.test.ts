import { confirmarQuitarFoto } from '../../src/utils/avisoQuitarFoto';

const SUBIDA = { fotoUrl: 'file:///document/photos/photo_t1.jpg', fotoSynced: true };
const REMOTA = { fotoUrl: 'plantations/p/parcelas/x/trees/t1.jpg', fotoSynced: true };
const SIN_SUBIR = { fotoUrl: 'file:///document/photos/photo_t1.jpg', fotoSynced: false };
const QUITADA = { requiereConfirmacion: false };
const FALTA_CONFIRMAR = { requiereConfirmacion: true };

async function quitar(foto: { fotoUrl: string | null; fotoSynced: boolean | null }, respuestas = [QUITADA]) {
  const show = jest.fn();
  const quitarFoto = jest.fn();
  for (const r of respuestas) quitarFoto.mockResolvedValueOnce(r);
  confirmarQuitarFoto(show, foto, quitarFoto);
  await Promise.resolve();
  await Promise.resolve();
  return { show, config: show.mock.calls[0]?.[0], quitarFoto };
}

describe('confirmarQuitarFoto: foto ya subida (#816)', () => {
  it.each([['bajada', SUBIDA], ['sin bajar', REMOTA]])('%s: pide confirmar con el texto de quitar para todos', async (_, foto) => {
    const { config, quitarFoto } = await quitar(foto);
    expect(config.title).toBe('Quitar la foto del árbol');
    expect(config.message).toBe('Se quita para todos los que vean este árbol.');
    expect(config.buttons.map((b: any) => [b.label, b.style])).toEqual([['Cancelar', 'cancel'], ['Quitar', 'danger']]);
    expect(quitarFoto).not.toHaveBeenCalled();
  });

  it('sin dato de sync pregunta igual', async () => {
    expect((await quitar({ fotoUrl: SIN_SUBIR.fotoUrl, fotoSynced: null })).show).toHaveBeenCalled();
  });

  it('cancelar no quita la foto', async () => {
    const { config, quitarFoto } = await quitar(SUBIDA);
    config.buttons[0].onPress();
    expect(quitarFoto).not.toHaveBeenCalled();
  });

  it('confirmar la quita para todos', async () => {
    const { config, quitarFoto } = await quitar(SUBIDA);
    config.buttons[1].onPress();
    expect(quitarFoto).toHaveBeenCalledWith(true);
  });
});

describe('confirmarQuitarFoto: foto sin subir (#816)', () => {
  it('la deshace sin preguntar', async () => {
    const { show, quitarFoto } = await quitar(SIN_SUBIR);
    expect(show).not.toHaveBeenCalled();
    expect(quitarFoto).toHaveBeenCalledWith(false);
  });

  // Se subió entre que la pantalla la mostró y el toque: no se quita sin preguntar.
  it('si ya se había subido, pregunta y confirmar la quita para todos', async () => {
    const { config, quitarFoto } = await quitar(SIN_SUBIR, [FALTA_CONFIRMAR, QUITADA]);
    expect(config.title).toBe('Quitar la foto del árbol');
    config.buttons[1].onPress();
    expect(quitarFoto.mock.calls).toEqual([[false], [true]]);
  });
});
