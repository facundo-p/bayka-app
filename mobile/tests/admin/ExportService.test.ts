// Tests for ExportService — CSV and Excel file generation and sharing
// Covers: EXPO-01, EXPO-02, EXPO-PARC-01, EXPO-PARC-02 (9-column header, D-18-08)

jest.mock('../../src/queries/exportQueries', () => ({
  getExportRows: jest.fn(),
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
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';

const mockGetExportRows = getExportRows as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

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
    parcelaNombre: null, // legacy group — D-18-10 normalizes to ''
    grupoNombre: 'Línea B',
    subId: 'LB-EU-2',
    periodo: '2026',
    especieNombre: 'Eucalipto, blanco',
  },
];

const EXPECTED_HEADER =
  'ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie\n';

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
      const writtenContent: string = mockWrite.mock.calls[0][0];
      // El CSV arranca con el BOM UTF-8 para que Excel respete los acentos.
      expect(writtenContent.startsWith(String.fromCharCode(0xFEFF))).toBe(true);
      expect(writtenContent.slice(1).startsWith(EXPECTED_HEADER)).toBe(true);
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

      const writtenContent: string = mockWrite.mock.calls[0][0];
      const lines = writtenContent.split('\n');
      // Line 1 (index 1) = first data row
      const firstRowCols = lines[1].split(',');
      // index: 0 globalId, 1 idParcial, 2 Zona, 3 Plantación, 4 Parcela, 5 Grupo, ...
      expect(firstRowCols[4]).toBe('Parcela 1');
      expect(firstRowCols[3]).toBe('Zona Norte'); // Plantación
    });

    it('Test 4: null parcelaNombre is normalized to "" (D-18-10)', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      const writtenContent: string = mockWrite.mock.calls[0][0];
      // Second data row has parcelaNombre = null → must serialize as empty string
      expect(writtenContent).not.toContain('null');
      // Verify the second row's Parcela column (after Plantación "Zona, Sur" quoted)
      // Easiest: split and check column 4 of the row containing globalId 11
      const lines = writtenContent.split('\n');
      const row11 = lines.find((l) => l.startsWith('11,'));
      expect(row11).toBeDefined();
      // Account for quoted "Zona, Sur" — use a regex to find the parcela column.
      // Cols: 11, 2, "Zona, Sur", "Zona, Sur", , Línea B, ...
      // The Parcela column is between the two quoted "Zona, Sur" and "Línea B".
      expect(row11).toContain('"Zona, Sur","Zona, Sur",,Línea B');
    });

    it('Test 5: quotes fields that contain commas', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      const writtenContent: string = mockWrite.mock.calls[0][0];
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

    it('Test 7: Excel normalizes null parcelaNombre to "" (D-18-10)', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      const sheetArg = (XLSX.utils.json_to_sheet as jest.Mock).mock.calls[0][0];
      expect(sheetArg[1]['Parcela']).toBe('');
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
  });
});
