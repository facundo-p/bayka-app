// Tests for ExportService — CSV and Excel file generation and sharing
// Covers: EXPO-01, EXPO-02

jest.mock('../../src/queries/exportQueries', () => ({
  getExportRows: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  cacheDirectory: 'file:///cache/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));

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
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';

const mockGetExportRows = getExportRows as jest.Mock;
const mockWriteAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const mockShareAsync = Sharing.shareAsync as jest.Mock;

const sampleRows = [
  {
    globalId: 10,
    idParcial: 1,
    lugar: 'Zona Norte',
    subgrupoNombre: 'Línea A',
    subId: 'LA-SP-1',
    periodo: '2026',
    especieNombre: 'Pino',
  },
  {
    globalId: 11,
    idParcial: 2,
    lugar: 'Zona, Sur',
    subgrupoNombre: 'Línea B',
    subId: 'LB-SP-2',
    periodo: '2026',
    especieNombre: 'Eucalipto, blanco',
  },
];

describe('ExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetExportRows.mockResolvedValue(sampleRows);
  });

  // ─── exportToCSV ──────────────────────────────────────────────────────────

  describe('exportToCSV', () => {
    it('Test 1: builds CSV with header "ID Global,ID Parcial,Zona,SubGrupo,SubID,Periodo,Especie"', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
      const writtenContent: string = mockWriteAsStringAsync.mock.calls[0][1];
      expect(writtenContent).toContain('ID Global,ID Parcial,Zona,SubGrupo,SubID,Periodo,Especie');
    });

    it('Test 2: calls Sharing.shareAsync with mimeType "text/csv"', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      expect(mockShareAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledWith(
        expect.stringContaining('ZonaNorte'),
        expect.objectContaining({ mimeType: 'text/csv' })
      );
    });

    it('Test 5: quotes fields that may contain commas', async () => {
      await exportToCSV('plantation-1', 'ZonaNorte');

      const writtenContent: string = mockWriteAsStringAsync.mock.calls[0][1];
      // "Zona, Sur" contains comma — must be quoted
      expect(writtenContent).toContain('"Zona, Sur"');
      // "Eucalipto, blanco" contains comma — must be quoted
      expect(writtenContent).toContain('"Eucalipto, blanco"');
    });
  });

  // ─── exportToExcel ────────────────────────────────────────────────────────

  describe('exportToExcel', () => {
    it('Test 3: calls XLSX.utils.json_to_sheet and XLSX.write with type "base64"', async () => {
      await exportToExcel('plantation-1', 'ZonaNorte');

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledTimes(1);
      expect(XLSX.write).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'base64', bookType: 'xlsx' })
      );
    });

    it('Test 4: calls Sharing.shareAsync with xlsx mimeType', async () => {
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
