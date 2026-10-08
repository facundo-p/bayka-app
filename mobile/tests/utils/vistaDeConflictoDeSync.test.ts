import { textoDeDistancia, textoDeMotivo, vistaDeConflictoDeSync } from '../../src/utils/vistaDeConflictoDeSync';
import type { ConflictoParaResolver } from '../../src/types/conflictoDeSync';
import { conflictosDelGrupo, seccionesDeConflictos, textoDeAvisoDeGrupo } from '../../src/utils/seccionesDeConflictos';

const ARBOL = {
  id: 't1', subId: 'L1PT3', posicion: 3, especieId: 'sp-pt',
  latitude: -27.36, longitude: -55.89, gpsAccuracy: 12.4, gpsCapturedAt: null, fotoUrl: 'plantations/p/trees/t1-v2.jpg',
};
const GRUPO = { id: 'g1', parcelaId: 'x1', codigo: 'G12', nombre: 'Línea norte', tipo: 'linea', estado: 'finalizada' };

function conflicto(campo: string, mio: unknown, extra: Partial<ConflictoParaResolver> = {}): ConflictoParaResolver {
  return {
    conflicto: {
      entidadId: campo === 'nombre' || campo === 'tipo' ? 'g1' : 't1', campo: campo as never, grupoId: 'g1',
      plantacionId: 'p1', mio, servidor: null, detectadoEn: '2026-10-08T10:00:00',
    },
    arbol: ARBOL, grupo: GRUPO, especies: { mia: null, servidor: null }, motivo: null, ...extra,
  };
}

describe('vistaDeConflictoDeSync', () => {
  it('GPS: coordenadas y precisión de cada lado, y la distancia entre los dos puntos', () => {
    const mio = { latitude: -27.3604, longitude: -55.89, gpsAccuracy: 4, gpsCapturedAt: null };
    const vista = vistaDeConflictoDeSync(conflicto('gps', mio), true);

    expect(vista.titulo).toBe('Ubicación GPS');
    expect(vista.mio).toMatchObject({ origen: 'En este teléfono', valor: '-27.36040, -55.89000' });
    expect(vista.otro).toMatchObject({ origen: 'En el servidor', valor: '-27.36000, -55.89000', detalle: '±12 m' });
    expect(vista.nota).toBe('Los dos puntos están a 45 m.');
  });

  it('GPS sin punto del servidor: no hay distancia', () => {
    const mio = { latitude: -27.3604, longitude: -55.89, gpsAccuracy: 4, gpsCapturedAt: '2026-10-08T10:40:00' };
    const arbol = { ...ARBOL, latitude: null, longitude: null };
    const vista = vistaDeConflictoDeSync(conflicto('gps', mio, { arbol }), true);

    expect(vista.otro.valor).toBe('Sin punto GPS');
    expect(vista.nota).toBeNull();
  });

  it('especie: nombre y código; N/N del lado del servidor', () => {
    const especies = { mia: { nombre: 'Eucalyptus grandis', codigo: 'EG' }, servidor: null };
    const vista = vistaDeConflictoDeSync(conflicto('especie', 'sp-eg', { especies, arbol: { ...ARBOL, especieId: null } }), true);

    expect(vista.mio.valor).toBe('Eucalyptus grandis (EG)');
    expect(vista.otro.valor).toBe('N/N');
  });

  it('foto: las dos miniaturas y la advertencia de que la propia se borra si queda la del servidor', () => {
    const vista = vistaDeConflictoDeSync(conflicto('foto', 'file:///mia.jpg'), false);

    expect(vista.mio.foto).toEqual({ treeId: 't1', uri: 'file:///mia.jpg', enLinea: false, descripcion: 'Foto sacada en este teléfono' });
    expect(vista.otro.foto).toEqual({ treeId: 't1', uri: ARBOL.fotoUrl, enLinea: false, descripcion: 'Foto del servidor' });
    expect(vista.advertencia).toBe('Si queda la del servidor, la foto sacada en este teléfono se borra.');
  });

  it('foto propia que no se puede conservar: la advertencia dice que al guardar se borra', () => {
    const vista = vistaDeConflictoDeSync(conflicto('foto', 'file:///mia.jpg', { motivo: 'plantacion_no_editable' }), true);

    expect(vista.advertencia).toBe('Al guardar se borra la foto sacada en este teléfono.');
  });

  it('foto que se había quitado acá: sin foto propia, sin advertencia y con el motivo claro', () => {
    const vista = vistaDeConflictoDeSync(conflicto('foto', null, { motivo: 'conflicto_sin_valor' }), true);

    expect(vista.mio.valor).toBe('Sin foto');
    expect(vista.advertencia).toBeNull();
    expect(vista.motivo).toBe('Habías quitado la foto en este teléfono; eso no se puede volver a aplicar desde acá.');
  });

  it('un guardado que no se aplicó: "cambió de nuevo" siempre; un error, solo si no hay motivo a la vista', () => {
    expect(vistaDeConflictoDeSync(conflicto('gps', null), true, 'cambio').aviso).toMatch(/^Cambió de nuevo/);
    expect(vistaDeConflictoDeSync(conflicto('gps', null), true, 'error').aviso)
      .toBe('No se pudo guardar esta elección. Probá de nuevo.');
    expect(vistaDeConflictoDeSync(conflicto('gps', null, { motivo: 'sin_permiso' }), true, 'error').aviso).toBeNull();
    expect(vistaDeConflictoDeSync(conflicto('gps', null), true).aviso).toBeNull();
  });

  it('dato del grupo: valor contra valor, con la etiqueta del tipo', () => {
    const vista = vistaDeConflictoDeSync(conflicto('tipo', 'bosquete'), true);

    expect(vista.titulo).toBe('Tipo de grupo');
    expect([vista.mio.valor, vista.otro.valor]).toEqual(['Bosquete', 'Línea']);
  });

  it('con motivo, lo propio se marca no disponible y el motivo se explica', () => {
    const vista = vistaDeConflictoDeSync(conflicto('nombre', 'Línea sur', { motivo: 'nombre_duplicate' }), true);

    expect(vista.mio.origen).toBe('En este teléfono · no disponible');
    expect(vista.motivo).toBe(
      'Ya hay otro grupo «Línea sur» en esta parcela. Cambiale el nombre al otro grupo o quedate con el del servidor.',
    );
  });

  it('árbol borrado: no hay valor del servidor', () => {
    const vista = vistaDeConflictoDeSync(conflicto('foto', 'file:///mia.jpg', { arbol: null, motivo: 'conflicto_inexistente' }), true);

    expect(vista.otro.valor).toBe('El árbol ya no existe');
    expect(vista.motivo).toBe('Este árbol se borró en otro celular o en la web. Tu cambio no se puede aplicar.');
  });
});

describe('textos', () => {
  it('motivos de la plantación y de la especie', () => {
    expect(textoDeMotivo('plantacion_no_editable', { campo: 'gps', mio: null }))
      .toBe('La plantación está finalizada. Para conservar la tuya, pedí que la reabran.');
    expect(textoDeMotivo('conflicto_sin_valor', { campo: 'especie', mio: 'sp' })).toBe('Tu especie ya no está en la plantación.');
    expect(textoDeMotivo('conflicto_sin_valor', { campo: 'especie', mio: null }))
      .toBe('Dejaste el árbol sin especie; eso no se puede volver a aplicar.');
  });

  it('duplicado: el texto del campo que choca', () => {
    expect(textoDeMotivo('codigo_duplicate', { campo: 'codigo', mio: 'g7' })).toMatch(/^Ya hay otro grupo con el código «G7»/);
    expect(textoDeMotivo('nombre_duplicate', { campo: 'nombre', mio: 'Sur' })).toMatch(/^Ya hay otro grupo «Sur»/);
    expect(textoDeMotivo('both_duplicate', { campo: 'codigo', mio: 'g7' })).toMatch(/código «G7»/);
  });

  it('distancia en metros o en km', () => {
    expect(textoDeDistancia(48.4)).toBe('48 m');
    expect(textoDeDistancia(1520)).toBe('1,5 km');
  });
});

describe('secciones', () => {
  it('varios grupos: por código de grupo, sin importar el id ni el orden de llegada', () => {
    const grupoB = { ...GRUPO, id: 'a-primero', codigo: 'B2' };
    const deB = (c: ConflictoParaResolver): ConflictoParaResolver =>
      ({ ...c, grupo: grupoB, conflicto: { ...c.conflicto, grupoId: grupoB.id, entidadId: `${c.conflicto.entidadId}-b` } });
    const secciones = seccionesDeConflictos([
      deB(conflicto('gps', null)),
      conflicto('gps', null),
      deB(conflicto('nombre', 'Otra')),
    ]);

    expect(secciones.map((s) => [s.titulo, s.sub])).toEqual([
      ['Grupo B2', 'Línea norte'],
      ['Árbol L1PT3', 'Grupo B2'],
      ['Árbol L1PT3', 'Grupo G12'],
    ]);
  });

  it('dentro de un árbol, los campos en orden fijo', () => {
    const [seccion] = seccionesDeConflictos([conflicto('foto', 'file:///a.jpg'), conflicto('especie', 'sp'), conflicto('gps', null)]);

    expect(seccion.conflictos.map((c) => c.conflicto.campo)).toEqual(['especie', 'gps', 'foto']);
  });

  it('una por grupo y por árbol: los datos del grupo primero y los árboles por posición', () => {
    const otro = { ...ARBOL, id: 't0', subId: 'L1PT1', posicion: 1 };
    const secciones = seccionesDeConflictos([
      conflicto('gps', null),
      conflicto('nombre', 'Otra'),
      { ...conflicto('foto', 'file:///mia.jpg'), arbol: otro, conflicto: { ...conflicto('foto', '').conflicto, entidadId: 't0', mio: 'file:///mia.jpg' } },
      conflicto('especie', 'sp-eg'),
    ]);

    expect(secciones.map((s) => [s.titulo, s.sub, s.conflictos.length])).toEqual([
      ['Grupo G12', 'Línea norte', 1],
      ['Árbol L1PT1', 'Grupo G12', 1],
      ['Árbol L1PT3', 'Grupo G12', 2],
    ]);
  });
});

describe('aviso dentro del grupo', () => {
  it('árboles y datos del grupo, en singular o plural', () => {
    const texto = (filas: { entidadId: string; campo: never }[]) => textoDeAvisoDeGrupo(conflictosDelGrupo(filas));
    const fila = (entidadId: string, campo: string) => ({ entidadId, campo: campo as never });

    expect(texto([fila('t1', 'gps'), fila('t1', 'foto'), fila('t2', 'gps'), fila('g1', 'nombre')]))
      .toBe('2 árboles y el nombre del grupo tienen cambios por resolver. El grupo no termina de sincronizarse hasta que elijas.');
    expect(texto([fila('t1', 'gps')])).toBe('1 árbol tiene cambios por resolver. El grupo no termina de sincronizarse hasta que elijas.');
    expect(texto([fila('g1', 'nombre'), fila('g1', 'codigo')])).toMatch(/^Los datos del grupo tienen/);
    expect(texto([])).toBeNull();
  });
});
