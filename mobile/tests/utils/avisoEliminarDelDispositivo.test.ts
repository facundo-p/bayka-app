import { avisoEliminarDelDispositivo, detalleDePendientes } from '../../src/utils/avisoEliminarDelDispositivo';

const SIN_PENDIENTES = { activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0 };

describe('detalleDePendientes', () => {
  it('lista cada tipo pendiente, no solo los grupos', () => {
    expect(detalleDePendientes({ activaCount: 1, finalizadaCount: 2, parcelas: 1, fotos: 4, borrados: 2 }))
      .toBe('3 grupos sin subir (1 activo, 2 finalizados), 1 parcela pendiente, 4 fotos sin subir, 2 borrados pendientes');
  });

  it('omite lo que está en cero', () => {
    expect(detalleDePendientes({ ...SIN_PENDIENTES, fotos: 1 })).toBe('1 foto sin subir');
    expect(detalleDePendientes(SIN_PENDIENTES)).toBe('');
  });
});

describe('avisoEliminarDelDispositivo', () => {
  it('sin pendientes y existente: una sola confirmación, se puede volver a descargar', () => {
    const aviso = avisoEliminarDelDispositivo({ lugar: 'Norte', eliminada: false, resumen: SIN_PENDIENTES });

    expect(aviso.confirmacionFinal).toBeUndefined();
    expect(aviso.mensaje).toContain('volver a descargarla');
  });

  it('con pendientes: doble confirmación y dice qué se pierde', () => {
    const aviso = avisoEliminarDelDispositivo({
      lugar: 'Norte', eliminada: false, resumen: { ...SIN_PENDIENTES, borrados: 3 },
    });

    expect(aviso.confirmacionFinal).toBeDefined();
    expect(aviso.mensaje).toContain('3 borrados pendientes');
  });

  it('eliminada con pendientes: aclara que ya no se pueden subir', () => {
    const aviso = avisoEliminarDelDispositivo({
      lugar: 'Norte', eliminada: true, resumen: { ...SIN_PENDIENTES, parcelas: 2 },
    });

    expect(aviso.titulo).toBe('Plantacion eliminada en el servidor');
    expect(aviso.mensaje).toContain('ya no se pueden subir');
    expect(aviso.mensaje).toContain('2 parcelas pendientes');
    expect(aviso.confirmacionFinal).toContain('no se puede deshacer');
  });

  it('eliminada sin pendientes: no promete volver a descargarla y avisa que es irreversible', () => {
    const aviso = avisoEliminarDelDispositivo({ lugar: 'Norte', eliminada: true, resumen: SIN_PENDIENTES });

    expect(aviso.mensaje).not.toContain('Podras volver a descargarla');
    expect(aviso.mensaje).toContain('no se puede deshacer');
  });
});
