import {
  baseDeLaEdicion,
  edicionDelFormulario,
  rebaseDeEdicionPendiente,
  aColumnasRemotas,
  aSnapshot,
  cambiosParaElServer,
  camposCambiados,
  desdeFilaRemota,
  hayCambios,
  remotosNoEditados,
  tieneCambiosSinSubir,
  restaurarDesdeSnapshot,
  snapshotAntesDeEditar,
} from '../../src/utils/camposDePlantacion';

describe('campos de plantación', () => {
  it('mapea a las columnas de Supabase solo lo presente', () => {
    expect(aColumnasRemotas({ lugar: 'L', fechaInicio: '2026-04-15', objetivoArboles: null, visibleInApp: false }))
      .toEqual({ lugar: 'L', fecha_inicio: '2026-04-15', objetivo_arboles: null, visible_in_app: false });
  });

  it('de una fila remota omite columnas ausentes y el null de las obligatorias', () => {
    const campos = desdeFilaRemota({
      lugar: 'L', periodo: 'P', descripcion: null, gps_capture_frequency: null, visible_in_app: false,
    });
    expect(campos).toEqual({ lugar: 'L', periodo: 'P', descripcion: null, visibleInApp: false });
  });

  it('el snapshot usa las columnas *Server', () => {
    expect(aSnapshot({ lugar: 'L', photoCaptureAllTrees: true, objetivoArboles: 5 }))
      .toEqual({ lugarServer: 'L', photoCaptureAllTreesServer: true, objetivoArbolesServer: 5 });
  });

  it('al entrar en edición toma el snapshot del pull y, si falta, el valor vivo', () => {
    const fila: any = {
      lugar: 'Vivo', lugarServer: 'Server', periodo: '2026', periodoServer: null,
      descripcion: 'Viva', descripcionServer: null, visibleInApp: false, visibleInAppServer: null,
    };
    expect(snapshotAntesDeEditar(fila)).toMatchObject({
      lugarServer: 'Server', periodoServer: '2026', descripcionServer: 'Viva', visibleInAppServer: false,
    });
  });

  it('al descartar, un opcional vuelve a null y un obligatorio sin snapshot no se toca', () => {
    const fila: any = {
      lugarServer: 'L', periodoServer: 'P', descripcionServer: null, objetivoArbolesServer: 12000,
      visibleInAppServer: null, photoCaptureAllTreesServer: false,
    };
    const restaurados = restaurarDesdeSnapshot(fila);
    expect(restaurados).toMatchObject({ lugar: 'L', descripcion: null, objetivoArboles: 12000, photoCaptureAllTrees: false });
    expect(restaurados).not.toHaveProperty('visibleInApp');
  });
});

describe('qué subir al server', () => {
  const FILA: any = {
    lugar: 'Lote Norte', periodo: 'Otoño 2026', descripcion: null, fechaInicio: null, objetivoArboles: null,
    gpsCaptureFrequency: 10, gpsCaptureRequired: true, photoCaptureAllTrees: false, visibleInApp: true,
    pendingEdit: false,
  };

  it('camposCambiados deja solo lo distinto e ignora lo ausente', () => {
    expect(camposCambiados({ lugar: 'A', descripcion: null }, { lugar: 'B', descripcion: null })).toEqual({ lugar: 'B' });
    expect(camposCambiados({ descripcion: null }, { descripcion: 'Nueva' })).toEqual({ descripcion: 'Nueva' });
    expect(camposCambiados({ descripcion: 'Vieja' }, { descripcion: null })).toEqual({ descripcion: null });
  });

  it('camposCambiados no manda un obligatorio que la base no conoce', () => {
    expect(camposCambiados({ visibleInApp: null } as any, { visibleInApp: false })).toEqual({});
  });

  it('online compara contra el valor vivo: los null nunca pulleados no se mandan', () => {
    const cambios = cambiosParaElServer(FILA, { lugar: 'Campo Sur', descripcion: null, objetivoArboles: null });
    expect(cambios).toEqual({ lugar: 'Campo Sur' });
  });

  it('con edición pendiente compara contra el snapshot, e incluye lo editado antes', () => {
    const fila = {
      ...FILA, pendingEdit: true, lugar: 'Campo Sur', lugarServer: 'Lote Norte', periodoServer: 'Otoño 2026',
      descripcion: 'Mía', descripcionServer: null, objetivoArbolesServer: null,
      visibleInAppServer: true, photoCaptureAllTreesServer: null,
    };
    expect(cambiosParaElServer(fila, { objetivoArboles: 500 }))
      .toEqual({ lugar: 'Campo Sur', descripcion: 'Mía', objetivoArboles: 500 });
  });

  it('hayCambios', () => {
    expect(hayCambios({})).toBe(false);
    expect(hayCambios({ descripcion: null })).toBe(true);
  });
});

describe('pull con edición pendiente', () => {
  it('actualiza el valor vivo solo de los campos no editados', () => {
    const fila: any = {
      lugar: 'Campo Sur', lugarServer: 'Lote Norte',
      descripcion: null, descripcionServer: null,
      objetivoArboles: null, objetivoArbolesServer: 12000,
      visibleInApp: true, visibleInAppServer: true,
    };
    const remotos = { lugar: 'Lote Web', descripcion: 'De la web', objetivoArboles: 15000, visibleInApp: false };
    // lugar editado y objetivo borrado a propósito: no se tocan.
    expect(remotosNoEditados(fila, remotos)).toEqual({ descripcion: 'De la web', visibleInApp: false });
  });
});

describe('tieneCambiosSinSubir', () => {
  it('cuenta la edición pendiente y el alta sin terminar de subir', () => {
    expect(tieneCambiosSinSubir({ pendingEdit: false, pendingSync: false })).toBe(false);
    expect(tieneCambiosSinSubir({ pendingEdit: true, pendingSync: false })).toBe(true);
    expect(tieneCambiosSinSubir({ pendingEdit: false, pendingSync: true })).toBe(true);
  });

  describe('base de la edición (#634)', () => {
    const FILA_BASE: any = {
      lugar: 'Lote Norte', periodo: '2026', descripcion: null, fechaInicio: null, objetivoArboles: 12000,
      gpsCaptureFrequency: 10, gpsCaptureRequired: true, photoCaptureAllTrees: false, visibleInApp: true,
      lugarServer: 'Lote Norte', periodoServer: '2026', descripcionServer: null, fechaInicioServer: null,
      objetivoArbolesServer: 12000, gpsCaptureFrequencyServer: 10, gpsCaptureRequiredServer: true,
      photoCaptureAllTreesServer: false, visibleInAppServer: true, pendingEdit: false, baseDeEdicion: null,
    };

    it('con edición pendiente, la base guardada gana sobre el snapshot', () => {
      const fila = { ...FILA_BASE, pendingEdit: true, objetivoArbolesServer: 12500, baseDeEdicion: { objetivoArboles: 12000 } };
      expect(baseDeLaEdicion(fila)).toEqual({ objetivoArboles: 12000 });
      expect(baseDeLaEdicion({ ...fila, baseDeEdicion: null }).objetivoArboles).toBe(12500);
    });

    it('del formulario sube solo lo tocado, con lo que vio como base', () => {
      const vistos = { ...FILA_BASE, descripcion: 'Vista' };
      const fila = { ...FILA_BASE, descripcion: 'Del pull' };
      const edicion = edicionDelFormulario(fila, { ...vistos, objetivoArboles: 15000 }, vistos);
      expect(edicion.tocados).toEqual({ objetivoArboles: 15000 });
      expect(edicion.cambios).toEqual({ objetivoArboles: 15000 });
      expect(edicion.base).toEqual({ objetivoArboles: 12000 });
    });

    it('con edición offline pendiente suma lo editado antes, con la base de entonces', () => {
      const fila = { ...FILA_BASE, pendingEdit: true, descripcion: 'Offline', baseDeEdicion: { ...FILA_BASE, descripcion: null } };
      const edicion = edicionDelFormulario(fila, { lugar: 'Nuevo' }, fila);
      expect(edicion.cambios).toEqual({ descripcion: 'Offline', lugar: 'Nuevo' });
      expect(edicion.base).toEqual({ descripcion: null, lugar: 'Lote Norte' });
    });

    it('el pull con edición pendiente mueve también la base de lo no editado', () => {
      const fila = { ...FILA_BASE, pendingEdit: true, descripcion: 'Offline', baseDeEdicion: { lugar: 'Lote Norte', descripcion: null } };
      expect(rebaseDeEdicionPendiente(fila, { lugar: 'Lote Sur', descripcion: 'Web' })).toEqual({
        lugar: 'Lote Sur', baseDeEdicion: { lugar: 'Lote Sur', descripcion: null },
      });
    });
  });
});
