import type { FilaExportacion } from '../../queries/exportacionQueries';
import { construirCsvExportacion, nombreArchivoCsv } from '../exportarCsv';

const ENCABEZADO = 'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie';

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

describe('construirCsvExportacion', () => {
  test('primera línea = encabezado en el orden canónico (9 columnas)', () => {
    const csv = construirCsvExportacion([]);
    expect(csv).toBe(ENCABEZADO);
  });

  test('una fila por árbol, en el orden de columnas', () => {
    const csv = construirCsvExportacion([fila()]);
    const lineas = csv.split('\n');
    expect(lineas[0]).toBe(ENCABEZADO);
    expect(lineas[1]).toBe('1001,12,Sitio,Sitio,Norte,Línea 1,A-001,2025-2026,Quebracho');
  });

  test('idGlobal/idParcial null → celdas vacías', () => {
    const csv = construirCsvExportacion([fila({ idGlobal: null, idParcial: null })]);
    expect(csv.split('\n')[1]).toBe(',,Sitio,Sitio,Norte,Línea 1,A-001,2025-2026,Quebracho');
  });

  test('parcela null → celda vacía', () => {
    const csv = construirCsvExportacion([fila({ parcela: null })]);
    // La columna Parcela (5ta) queda vacía entre "Sitio," y ",Línea 1".
    expect(csv.split('\n')[1]).toBe('1001,12,Sitio,Sitio,,Línea 1,A-001,2025-2026,Quebracho');
  });

  test('especie null → "N/N" (el árbol nunca se pierde)', () => {
    const csv = construirCsvExportacion([fila({ especie: null })]);
    expect(csv.split('\n')[1]).toBe('1001,12,Sitio,Sitio,Norte,Línea 1,A-001,2025-2026,N/N');
  });

  test('comilla campos con coma, comilla o salto de línea (RFC 4180)', () => {
    const csv = construirCsvExportacion([
      fila({ especie: 'Quebracho, blanco', parcela: 'Lote "A"', grupo: 'Línea\n1' }),
    ]);
    const linea = csv.split('\n');
    // El salto de línea dentro del grupo parte la fila, pero queda comillado:
    // reunimos verificando fragmentos comillados.
    const csvCrudo = csv;
    expect(csvCrudo).toContain('"Quebracho, blanco"');
    expect(csvCrudo).toContain('"Lote ""A"""');
    expect(csvCrudo).toContain('"Línea\n1"');
    // El encabezado sigue siendo la primera línea.
    expect(linea[0]).toBe(ENCABEZADO);
  });
});

describe('nombreArchivoCsv', () => {
  test('slug seguro: minúsculas, sin acentos ni símbolos', () => {
    expect(nombreArchivoCsv('Estancia Ñañdú', '2024/2025')).toBe(
      'export-estancia-nandu-2024-2025.csv',
    );
  });

  test('omite partes vacías tras el slug', () => {
    expect(nombreArchivoCsv('!!!', '2025')).toBe('export-2025.csv');
  });
});
