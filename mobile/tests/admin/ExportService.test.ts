// Tests for ExportService — CSV and Excel file generation and sharing

jest.mock('../../src/queries/exportQueries', () => ({
  getExportRows: jest.fn(),
}));

// Refresco de especies previo al export: mockeado para no cargar supabase real.
jest.mock('../../src/services/sync/preSteps', () => ({
  pullSpeciesFromServer: jest.fn().mockResolvedValue(undefined),
}));

const mockWrite = jest.fn();

jest.mock('expo-file-system', () => {
  const mockDirectory = { uri: 'file:///cache/' };
  const MockFile = jest.fn().mockImplementation((_dir: unknown, name: string) => ({
    uri: `file:///cache/${name}`,
    write: mockWrite,
  }));
  return {
    File: MockFile,
    Paths: {
      cache: mockDirectory,
    },
  };
});

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: jest.fn().mockReturnValue({}),
    book_new: jest.fn().mockReturnValue({}),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn().mockReturnValue('base64encodedcontent=='),
}));

import { exportToCSV, exportToExcel } from '../../src/services/ExportService';
import { getExportRows } from '../../src/queries/exportQueries';
import { pullSpeciesFromServer } from '../../src/services/sync/preSteps';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';

const mockGetExportRows = getExportRows as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;
const mockPullSpecies = pullSpeciesFromServer as jest.Mock;

const sampleRows = [
  {
    globalId: 10,
    idParcial: 1,
    lugar: 'Zona Norte',
    plantacionLugar: 'Zona Norte',
    parcelaNombre: 'Parcela 1',
    grupoNombre: 'Línea A',
    subId: 'P1-LA-PI-1',
    periodo: '2026',
    especieNombre: 'Pino',
  },
  {
    globalId: 11,
    idParcial: 2,
    lugar: 'Zona, Sur',
    plantacionLugar: 'Zona, Sur',
    parcelaNombre: 'Sur 2',
    grupoNombre: 'Línea B',
    subId: 'LB-EU-2',
    periodo: '2026',
    especieNombre: 'Eucalipto, blanco',
  },
];

const EXPECTED_HEADER =
  'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie\n';

// El CSV se escribe como bytes (BOM EF BB BF + UTF-8) cuando hay TextEncoder.
// Decodifica el contenido escrito (Uint8Array o string) a string sin el BOM.
function decodeWritten(arg: unknown): string {
  if (arg instanceof Uint8Array) {
    const noBom = arg[0] === 0xef && arg[1] === 0xbb && arg[2] === 0xbf ? arg.slice(3) : arg;
    return new TextDecoder().decode(noBom);
  }
  return String(arg).replace(/^﻿/, '');
}

describe('ExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrite.mockReset();
    mockGetExportRows.mockResolvedValue(sampleRows);
  });

  // ─── exportToCSV ──────────────────────────────────────────────────────────

  describe('exportToCSV', () => {
    it('Test 1: builds CSV with exact 9-column header in ROADMAP order (D-18-08)', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      expect(mockWrite).toHaveBeenCalledTimes(1);
      const written = mockWrite.mock.calls[0][0];
      // El CSV arranca con el BOM UTF-8 (EF BB BF) para que Excel respete acentos.
      expect(written instanceof Uint8Array).toBe(true);
      expect([written[0], written[1], written[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(decodeWritten(written).startsWith(EXPECTED_HEADER)).toBe(true);
    });

    it('Test 2: calls Sharing.shareAsync with mimeType "text/csv"', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      expect(mockShareAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledWith(
        expect.stringContaining('ZonaNorte'),
        expect.objectContaining({ mimeType: 'text/csv' })
      );
    });

    it('Test 3: body has parcelaNombre at position 5 (0-indexed 4) for rows with parcela', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      const writtenContent: string = decodeWritten(mockWrite.mock.calls[0][0]);
      const lines = writtenContent.split('\n');
      const firstRowCols = lines[1].split(',');
      // Columnas: 0 globalId, 1 idParcial, 2 Zona, 3 Plantación, 4 Parcela, 5 Grupo, ...
      expect(firstRowCols[4]).toBe('Parcela 1');
      expect(firstRowCols[3]).toBe('Zona Norte'); // Plantación
    });

    it('Test 4: parcelaNombre viaja tal cual (#90: parcela obligatoria, sin normalización null)', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      const writtenContent: string = decodeWritten(mockWrite.mock.calls[0][0]);
      expect(writtenContent).not.toContain('null');
      const lines = writtenContent.split('\n');
      const row11 = lines.find((l) => l.startsWith('11,'));
      expect(row11).toBeDefined();
      // Cols: 11, 2, "Zona, Sur", "Zona, Sur", Sur 2, Línea B, ...
      expect(row11).toContain('"Zona, Sur","Zona, Sur",Sur 2,Línea B');
    });

    it('Test 5: quotes fields that contain commas', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      const writtenContent: string = decodeWritten(mockWrite.mock.calls[0][0]);
      expect(writtenContent).toContain('"Zona, Sur"');
      expect(writtenContent).toContain('"Eucalipto, blanco"');
    });
  });

  // ─── exportToExcel ────────────────────────────────────────────────────────

  describe('exportToExcel', () => {
    it('Test 6: calls XLSX.utils.json_to_sheet with 9-column rows in D-18-08 order', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(1);
      const sheetArg = (XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0];
      expect(sheetArg).toHaveLength(2);

      const keys = Object.keys(sheetArg[0]);
      expect(keys).toEqual([
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

      expect(sheetArg[0]['Plantación']).toBe('Zona Norte');
      expect(sheetArg[0]['Parcela']).toBe('Parcela 1');
      expect(sheetArg[0]['Grupo']).toBe('Línea A');
    });

    it('Test 7: parcelaNombre viaja tal cual en Excel (#90)', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      const sheetArg = (XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0];
      expect(sheetArg[1]['Parcela']).toBe('Sur 2');
    });

    it('Test 8: XLSX.write called with type "base64"', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      expect(XLSX.write).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'base64', bookType: 'xlsx' })
      );
    });

    it('Test 9: calls Sharing.shareAsync with xlsx mimeType', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      expect(mockShareAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledWith(
        expect.stringContaining('ZonaNorte'),
        expect.objectContaining({
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      );
    });

    // ─── Anchos de columna ajustados al contenido ────────────────────────────

    it('setea ws[!cols] = max(encabezado, valores) + 2 por columna (#54)', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      const ws = (XLSX.utils.json_to_sheet as jest.Mock).mock.results[0].value;
      // Ancho = max(largo header, largo de cada valor) + 2 de padding, por columna.
      expect(ws['!cols']).toEqual([
        { wch: 11 }, // ID Global (header 9)
        { wch: 12 }, // ID Parcial (header 10)
        { wch: 12 }, // Zona ('Zona Norte' 10)
        { wch: 12 }, // Plantación (header 10)
        { wch: 11 }, // Parcela ('Parcela 1' 9)
        { wch: 9 },  // Grupo ('Línea A' 7)
        { wch: 12 }, // SubID ('P1-LA-PI-1' 10)
        { wch: 9 },  // Periodo (header 7)
        { wch: 19 }, // Especie ('Eucalipto, blanco' 17)
      ]);
    });

    it('el ancho se topea en 100 caracteres (+2 de padding) (#54)', async () => {
      mockGetExportRows.mockResolvedValue([
        { ...sampleRows[0], especieNombre: 'x'.repeat(150) },
      ]);
      await exportToExcel('plantation-1', 'ZonaNorte');

      const ws = (XLSX.utils.json_to_sheet as jest.Mock).mock.results[0].value;
      expect(ws['!cols'][8]).toEqual({ wch: 102 });
    });

    it('sin filas no setea anchos (hoja vacía) (#54)', async () => {
      mockGetExportRows.mockResolvedValue([]);
      await exportToExcel('plantation-1', 'ZonaNorte');

      const ws = (XLSX.utils.json_to_sheet as jest.Mock).mock.results[0].value;
      expect(ws['!cols']).toEqual([]);
    });
  });

  // ─── Especie no resuelta (N/N) ──────────────────────────────────────────────

  describe('especie no resuelta → "N/N"', () => {
    const nnRow = {
      globalId: 5870,
      idParcial: 5870,
      lugar: 'Zona Norte',
      plantacionLugar: 'Zona Norte',
      parcelaNombre: 'Parcela 1',
      grupoNombre: 'Linea 14',
      subId: 'MP3L14ZZZ25',
      periodo: '2026',
      especieNombre: null, // especieId null o huérfano → LEFT JOIN devuelve null
    };

    it('Excel: especieNombre null se serializa como "N/N"', async () => {
      mockGetExportRows.mockResolvedValueOnce([nnRow]);

      await exportToExcel('plantation-1', 'ZonaNorte');

      const sheetArg = (XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0];
      expect(sheetArg[0]['Especie']).toBe('N/N');
    });

    it('CSV: especieNombre null se serializa como "N/N"', async () => {
      mockGetExportRows.mockResolvedValueOnce([nnRow]);

      await exportToCSV('plantation-1', 'ZonaNorte');

      const written: string = decodeWritten(mockWrite.mock.calls[0][0]);
      const dataRow = written.split('\n')[1].split(',');
      // index 8 = columna Especie
      expect(dataRow[8]).toBe('N/N');
    });
  });

  // ─── Refresco de especies previo al export ──────────────────────────────────

  describe('sync de especies previa', () => {
    it('Excel: refresca el catálogo de especies antes de leer las filas', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      expect(mockPullSpecies).toHaveBeenCalledTimes(1);
      // Debe ocurrir antes de getExportRows.
      expect(mockPullSpecies.mock.invocationCallOrder[0])
        .toBeLessThan(mockGetExportRows.mock.invocationCallOrder[0]);
    });

    it('CSV: refresca el catálogo de especies antes de leer las filas', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      expect(mockPullSpecies).toHaveBeenCalledTimes(1);
      expect(mockPullSpecies.mock.invocationCallOrder[0])
        .toBeLessThan(mockGetExportRows.mock.invocationCallOrder[0]);
    });

    it('no bloquea el export si el refresco de especies falla', async () => {
      mockPullSpecies.mockRejectedValueOnce(new Error('sin red'));

      await expect(exportToExcel('plantation-1', 'ZonaNorte')).resolves.toBeUndefined();
      expect(mockGetExportRows).toHaveBeenCalledTimes(1);
    });
  });
});
