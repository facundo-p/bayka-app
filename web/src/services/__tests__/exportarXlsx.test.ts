import type { FilaExportacion } from '../../queries/exportacionQueries';
import { COLUMNAS_XLSX, nombreArchivoXlsx } from '../exportarXlsx';

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

describe('nombreArchivoXlsx', () => {
  test('slug seguro con extensión .xlsx', () => {
    expect(nombreArchivoXlsx('Estancia Ñañdú', '2024/2025')).toBe(
      'export-estancia-nandu-2024-2025.xlsx',
    );
  });
});
