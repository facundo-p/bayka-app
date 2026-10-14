import {
  mensajeConfirmarLiberar,
  mensajeLiberado,
  mensajeNadaParaLiberar,
  rotuloLiberarEspacio,
  textoSinSubir,
} from '../../src/utils/avisoLiberarEspacio';

const MB = 1024 * 1024;

describe('aviso de Liberar espacio (#565)', () => {
  const base = { fotos: 212, bytes: 74 * MB, sinSubir: 0, sinConfirmar: 0 };

  it('dice qué se borra y que no se quita de Bayka', () => {
    const texto = mensajeConfirmarLiberar({ ...base, descargarFotos: true });
    expect(texto).toContain('Se borran de este celular 212 fotos (74 MB) que ya están en la nube.');
    expect(texto).toContain('No se quitan de Bayka ni de los demás celulares.');
  });

  it('con la descarga prendida avisa que la próxima sincronización las vuelve a bajar', () => {
    expect(mensajeConfirmarLiberar({ ...base, descargarFotos: true })).toContain('la próxima sincronización las vuelve a descargar');
  });

  it('con la descarga apagada avisa que quedan en la nube', () => {
    const texto = mensajeConfirmarLiberar({ ...base, descargarFotos: false });
    expect(texto).toContain('Quedan en la nube y podés descargarlas de a una desde cada árbol.');
    expect(texto).not.toContain('próxima sincronización');
  });

  it('cuenta las fotos sin subir y las no confirmadas que se conservan', () => {
    const texto = mensajeConfirmarLiberar({ ...base, sinSubir: 3, sinConfirmar: 1, descargarFotos: true });
    expect(texto).toContain('3 fotos sin subir se conservan.');
    expect(texto).toContain('1 foto que la nube no confirmó se conserva.');
  });

  it('singular y vacío de las fotos sin subir', () => {
    expect(textoSinSubir(1)).toBe('1 foto sin subir se conserva.');
    expect(textoSinSubir(0)).toBe('');
  });

  it('el botón muestra cuánto libera, o nada si no hay fotos', () => {
    expect(rotuloLiberarEspacio(212, 74 * MB)).toBe('Liberar espacio · 212 fotos, 74 MB');
    expect(rotuloLiberarEspacio(0, 0)).toBe('Liberar espacio');
  });

  it('nada para liberar y resultado', () => {
    expect(mensajeNadaParaLiberar(0)).toBe('No hay fotos descargadas en este celular.');
    expect(mensajeNadaParaLiberar(2)).toBe('La nube no confirmó 2 fotos de este celular, así que se conservan.');
    expect(mensajeLiberado(1, 2 * MB)).toBe('Se liberaron 2,0 MB en este celular (1 foto).');
  });
});
