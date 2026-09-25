/** Textos del aviso de pendientes varados y de su "Descartar" (#638). */
import {
  avisoDeLaTarjeta,
  confirmacionDeDescarte,
  descartarLaSaca,
  detalleDeDescarte,
  motivoDeVarado,
  totalDeCambios,
  varadosDelResumen,
  type ResumenDeDescarte,
} from '../../src/utils/avisoPendientesVarados';

const VACIO: ResumenDeDescarte = {
  activaCount: 0, finalizadaCount: 0, parcelas: 0, fotos: 0, borrados: 0, especies: 0, tecnicos: 0, edicion: false, alta: false, altaEnServidor: false,
};

describe('motivoDeVarado', () => {
  it('eliminada en el servidor gana sobre el motivo guardado', () => {
    expect(motivoDeVarado({ motivoVarado: 'finalizada', eliminadaEnServidorEn: '2026-09-20' })).toBe('eliminada');
  });

  it('sin marca, el que guardó el sync', () => {
    expect(motivoDeVarado({ motivoVarado: 'sin-permiso', eliminadaEnServidorEn: null })).toBe('sin-permiso');
    expect(motivoDeVarado({ motivoVarado: null, eliminadaEnServidorEn: null })).toBeNull();
  });
});

describe('aviso de la tarjeta', () => {
  it('cuenta cada cambio, la edición y el alta', () => {
    const r = { ...VACIO, alta: true, edicion: true, activaCount: 2, especies: 1 };
    expect(totalDeCambios(r)).toBe(5);
    expect(avisoDeLaTarjeta({ motivo: 'archivada', resumen: r })).toEqual({
      titulo: '5 cambios no se pudieron subir',
      motivo: 'La plantación está archivada. Si la desarchivan, se suben solos.',
    });
  });

  it('en singular con un solo cambio', () => {
    expect(avisoDeLaTarjeta({ motivo: 'sin-permiso', resumen: { ...VACIO, tecnicos: 1 } }).titulo).toBe('1 cambio no se pudo subir');
  });
});

describe('confirmación de Descartar', () => {
  it('dice qué se pierde, por tipo', () => {
    expect(detalleDeDescarte({ ...VACIO, edicion: true, especies: 2, tecnicos: 1 })).toBe(
      'los cambios en los datos de la plantación, 2 cambios de especies sin subir, 1 técnico asignado sin subir',
    );
  });

  it('existente: vuelve a como está en el server', () => {
    const { mensaje, boton, confirmacionFinal } = confirmacionDeDescarte({
      lugar: 'Norte', resumen: { ...VACIO, parcelas: 1 }, seVa: false, motivo: 'finalizada',
    });
    expect(mensaje).toBe(
      'Se pierden para siempre: 1 parcela pendiente. "Norte" vuelve a quedar como está en el servidor en la próxima sincronización. Esta acción no se puede deshacer.',
    );
    expect(boton).toBe('Descartar');
    expect(confirmacionFinal).toBeUndefined();
  });

  it('sin permiso el pull no corre: no promete volver al estado del servidor', () => {
    const { mensaje } = confirmacionDeDescarte({ lugar: 'Norte', resumen: { ...VACIO, parcelas: 1 }, seVa: false, motivo: 'sin-permiso' });
    expect(mensaje).toBe(
      'Se pierden para siempre: 1 parcela pendiente. Lo que ya estaba subido de "Norte" queda en este dispositivo. Esta acción no se puede deshacer.',
    );
  });

  it('alta: se pierde entera y sale del dispositivo', () => {
    const { mensaje, confirmacionFinal } = confirmacionDeDescarte({ lugar: 'Norte', resumen: { ...VACIO, alta: true }, seVa: true, motivo: 'sin-permiso' });
    expect(mensaje).toBe(
      'Se pierden para siempre: la plantación entera, que nunca llegó al servidor. "Norte" se elimina de este dispositivo. Esta acción no se puede deshacer.',
    );
    // Sale del dispositivo: doble confirmación, como "Eliminar del dispositivo".
    expect(confirmacionFinal).toBe('Los datos sin sincronizar se perderán para siempre. Esta acción no se puede deshacer.');
  });

  it('alta a medio subir: dice que en el servidor quedó creada', () => {
    const { mensaje } = confirmacionDeDescarte({
      lugar: 'Norte', resumen: { ...VACIO, alta: true, altaEnServidor: true }, seVa: true, motivo: 'finalizada',
    });
    expect(mensaje).toBe(
      'Se pierden para siempre: la plantación, que quedó a medio subir (en el servidor está creada, sin sus especies ni lo cargado en este teléfono). "Norte" se elimina de este dispositivo; podés volver a descargarla desde el catálogo. Esta acción no se puede deshacer.',
    );
  });

  it('en una finalizada no cuenta técnicos ni fotos: suben igual', () => {
    const r = { ...VACIO, tecnicos: 2, fotos: 3, activaCount: 1 };
    expect(totalDeCambios(varadosDelResumen(r, 'finalizada'))).toBe(1);
    expect(totalDeCambios(varadosDelResumen(r, 'archivada'))).toBe(6);
  });

  it('la saca del dispositivo un alta o una eliminada, no una existente', () => {
    expect(descartarLaSaca({ pendingSync: true, eliminadaEnServidorEn: null })).toBe(true);
    expect(descartarLaSaca({ pendingSync: false, eliminadaEnServidorEn: '2026-09-20' })).toBe(true);
    expect(descartarLaSaca({ pendingSync: false, eliminadaEnServidorEn: null })).toBe(false);
  });
});
