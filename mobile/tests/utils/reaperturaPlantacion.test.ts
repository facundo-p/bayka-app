import { esReabrible, mensajeConfirmacionReapertura, puedeReabrir } from '../../src/utils/reaperturaPlantacion';

const FINALIZADA = { estado: 'finalizada', archivadaEn: null, eliminadaEnServidorEn: null };

describe('reaperturaPlantacion (#637)', () => {
  it('solo el superadmin puede reabrir', () => {
    expect(puedeReabrir('superadmin')).toBe(true);
    expect(puedeReabrir('admin')).toBe(false);
    expect(puedeReabrir('tecnico')).toBe(false);
    expect(puedeReabrir(undefined)).toBe(false);
  });

  it('solo una finalizada, no archivada ni eliminada en el server, es reabrible', () => {
    expect(esReabrible(FINALIZADA)).toBe(true);
    expect(esReabrible({ ...FINALIZADA, estado: 'activa' })).toBe(false);
    expect(esReabrible({ ...FINALIZADA, archivadaEn: '2026-05-01' })).toBe(false);
    expect(esReabrible({ ...FINALIZADA, eliminadaEnServidorEn: '2026-05-01' })).toBe(false);
  });

  it('la confirmación dice lo mismo que la web', () => {
    expect(mensajeConfirmacionReapertura('Finca Norte')).toBe(
      'Finca Norte vuelve a estar activa: la app acepta registros de nuevo y el trabajo que quedó sin sincronizar se puede subir.\n\n' +
        'Los grupos ya finalizados siguen finalizados. Podés volver a finalizarla cuando quieras.',
    );
  });
});
