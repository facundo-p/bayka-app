import type { FilaExportacion } from '../../queries/exportacionQueries';
import { COLUMNAS_XLSX, columnasConAncho, nombreArchivoXlsx } from '../exportarXlsx';

function fila(parcial: Partial<FilaExportacion> = {}): FilaExportacion {
  return {
    idGlobal: 1001,
    idParcial: 12,
    zona: 'Sitio',
    plantacion: 'Sitio',
    parcela: 'Norte',
    grupo: 'Línea 1',
    subId: 'A-001',
    periodo: '2025-2026',
    especie: 'Quebracho',
    ...parcial,
  };
}

/** Celdas de una fila en el orden de columnas (como las serializa la librería). */
function celdas(filaExport: FilaExportacion) {
  return COLUMNAS_XLSX.map((columna) => columna.cell(filaExport, 0));
}

describe('COLUMNAS_XLSX', () => {
  test('encabezados en el orden canónico (9 columnas, D-18-08)', () => {
    expect(COLUMNAS_XLSX.map((columna) => columna.header)).toEqual([
      'ID Global',
      'ID Parcial',
      'Zona',
      'Plantación',
      'Parcela',
      'Grupo',
      'SubID',
      'Periodo',
      'Especie',
    ]);
  });

  test('ID Global / ID Parcial tipados como número (la ventaja sobre CSV)', () => {
    const [idGlobal, idParcial] = celdas(fila());
    expect(idGlobal).toEqual({ value: 1001, type: Number });
    expect(idParcial).toEqual({ value: 12, type: Number });
  });

  test('idGlobal/idParcial null → celdas vacías, no ceros ni texto', () => {
    const [idGlobal, idParcial] = celdas(fila({ idGlobal: null, idParcial: null }));
    expect(idGlobal).toBeNull();
    expect(idParcial).toBeNull();
  });

  test('parcela null → celda vacía y especie null → "N/N" (paridad con CSV)', () => {
    const valores = celdas(fila({ parcela: null, especie: null }));
    expect(valores[4]).toEqual({ value: '', type: String });
    expect(valores[8]).toEqual({ value: 'N/N', type: String });
  });

  test('textos con coma, comillas y acentos viajan intactos (sin escaping CSV)', () => {
    const valores = celdas(fila({ especie: 'Quebracho, "blanco" & ñandubay' }));
    expect(valores[8]).toEqual({ value: 'Quebracho, "blanco" & ñandubay', type: String });
  });
});

describe('columnasConAncho (#54)', () => {
  test('ancho = max(encabezado, celdas) + 2, por columna', () => {
    const columnas = columnasConAncho([fila()]);
    // Gana el header en ID Global/ID Parcial/Plantación; gana el dato en Zona
    // ('Sitio' 5), Parcela ('Norte' 5 < header 7 → header), Grupo ('Línea 1'),
    // Periodo ('2025-2026') y Especie ('Quebracho').
    expect(columnas.map((columna) => columna.width)).toEqual([
      11, // ID Global: header 9
      12, // ID Parcial: header 10
      7, // Zona: 'Sitio' 5
      12, // Plantación: header 10
      9, // Parcela: header 7
      9, // Grupo: 'Línea 1' 7
      7, // SubID: 5
      11, // Periodo: '2025-2026' 9
      11, // Especie: 'Quebracho' 9
    ]);
  });

  test('sin filas, el ancho es el del encabezado + 2', () => {
    const columnas = columnasConAncho([]);
    expect(columnas[0].width).toBe('ID Global'.length + 2);
    expect(columnas[8].width).toBe('Especie'.length + 2);
  });

  test('el ancho se topea en 100 caracteres (+2 de padding)', () => {
    const columnas = columnasConAncho([fila({ especie: 'x'.repeat(150) })]);
    expect(columnas[8].width).toBe(102);
  });

  test('no muta COLUMNAS_XLSX (devuelve copias con width)', () => {
    columnasConAncho([fila()]);
    expect(
      COLUMNAS_XLSX.every((columna) => !('width' in columna)),
    ).toBe(true);
  });
});

describe('nombreArchivoXlsx', () => {
  test('slug seguro con extensión .xlsx', () => {
    expect(nombreArchivoXlsx('Estancia Ñañdú', '2024/2025')).toBe(
      'export-estancia-nandu-2024-2025.xlsx',
    );
  });
});
