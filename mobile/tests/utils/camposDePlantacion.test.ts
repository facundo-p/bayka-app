import {
  aColumnasRemotas,
  aSnapshot,
  desdeFilaRemota,
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
