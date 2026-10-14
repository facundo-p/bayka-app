import type { ParcelaConStats } from '../../../queries/dataExplorerQueries';
import type { PuntoGps } from '../../../queries/mapaQueries';
import {
  alternar,
  armarAlcance,
  etiquetaEspecie,
  filtrarPuntos,
  parcelasDeTira,
} from '../filtrosDashboard';

function punto(codigo: string, parcelaId: string | null): PuntoGps {
  return { lat: 0, lng: 0, codigo, nombre: '', idArbol: '', subId: '', parcelaId };
}

function parcela(id: string, arboles: number): ParcelaConStats {
  const base = { descripcion: null, createdAt: '2026-06-01T00:00:00Z', grupos: 2 };
  return { ...base, id, codigo: id.toUpperCase(), nombre: `Parcela ${id}`, arboles };
}

describe('alternar', () => {
  test('elige lo nuevo y suelta lo que ya estaba elegido', () => {
    expect(alternar(null, 'QB')).toBe('QB');
    expect(alternar('AL', 'QB')).toBe('QB');
    expect(alternar('QB', 'QB')).toBeNull();
  });
});

describe('filtrarPuntos', () => {
  const puntos = [punto('QB', 'p1'), punto('AL', 'p1'), punto('QB', 'p2'), punto('NN', null)];

  test('sin filtros devuelve el mismo array, para que el mapa no re-encuadre', () => {
    expect(filtrarPuntos(puntos, { parcelaId: null, especieCodigo: null })).toBe(puntos);
  });

  test('por parcela, por especie y por las dos', () => {
    expect(filtrarPuntos(puntos, { parcelaId: 'p1', especieCodigo: null })).toEqual([
      puntos[0],
      puntos[1],
    ]);
    expect(filtrarPuntos(puntos, { parcelaId: null, especieCodigo: 'QB' })).toEqual([
      puntos[0],
      puntos[2],
    ]);
    expect(filtrarPuntos(puntos, { parcelaId: 'p2', especieCodigo: 'QB' })).toEqual([puntos[2]]);
  });
});

describe('parcelasDeTira', () => {
  const parcelas = [parcela('p1', 10), parcela('p2', 5)];

  test('sin especie la tira queda como viene', () => {
    expect(parcelasDeTira(parcelas, [], null)).toBe(parcelas);
  });

  test('con especie cada parcela cuenta solo esa especie, y 0 si no la tiene', () => {
    const porParcela = [{ id: 'p1', codigo: 'P1', nombre: 'Parcela p1', cantidad: 3 }];

    const tira = parcelasDeTira(parcelas, porParcela, 'QB');

    expect(tira.map((fila) => fila.arboles)).toEqual([3, 0]);
    expect(tira[0].grupos).toBe(2);
  });
});

describe('armarAlcance', () => {
  const especie = { codigo: 'QB', nombre: 'Quebracho', cantidad: 3, color: '#123456' };
  const verTodos = vi.fn();

  test('sin selección no hay alcance', () => {
    expect(armarAlcance(null, undefined, verTodos)).toBeUndefined();
  });

  test('nombra la parcela y después la especie, con su color', () => {
    expect(armarAlcance(parcela('p1', 1), especie, verTodos)).toEqual({
      selecciones: [
        { tipo: 'parcela', codigo: 'P1', nombre: 'Parcela p1' },
        { tipo: 'especie', codigo: 'QB', nombre: 'Quebracho', color: '#123456' },
      ],
      onVerTodos: verTodos,
    });
  });
});

describe('etiquetaEspecie', () => {
  test('una especie se nombra por su nombre; los sin identificar, N/N', () => {
    expect(etiquetaEspecie({ codigo: 'QB', nombre: 'Quebracho' })).toBe('Quebracho');
    expect(etiquetaEspecie({ codigo: 'NN', nombre: 'Sin identificar' })).toBe('N/N');
  });
});
