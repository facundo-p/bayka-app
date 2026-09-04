import { readFileSync } from 'node:fs';
import path from 'node:path';

// ExportService importa expo-file-system/expo-sharing/xlsx y queries/exportQueries (que a su vez
// abre el cliente SQLite real) a nivel de módulo: mockeados igual que en tests/admin/ExportService.test.ts
// para poder importar CSV_HEADER/rowToExcel sin correr ese I/O.
jest.mock('../src/queries/exportQueries', () => ({
  getExportRows: jest.fn(),
}));
jest.mock('../src/services/sync/preSteps', () => ({
  pullSpeciesFromServer: jest.fn(),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { cache: {} },
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('xlsx', () => ({
  utils: { json_to_sheet: jest.fn(), book_new: jest.fn(), book_append_sheet: jest.fn() },
  write: jest.fn(),
}));

import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../src/constants/gpsCapture';
import { UNKNOWN_SPECIES_CODE } from '../src/utils/speciesHelpers';
import { CSV_HEADER, rowToExcel } from '../src/services/ExportService';
import { ROL } from '../src/constants/roles';
import { ESTADO_PLANTACION } from '../src/constants/estados';
import type { ExportRow } from '../src/queries/exportQueries';

/** Lee un contrato de `contracts/` y descarta `_comment` (no forma parte de los valores a comparar). */
function leerContrato(nombre: string): Record<string, unknown> {
  const contrato = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../contracts', nombre), 'utf8'),
  );
  delete contrato._comment;
  return contrato;
}

const FILA_EXPORT_VACIA: ExportRow = {
  globalId: null,
  idParcial: null,
  lugar: '',
  plantacionLugar: '',
  parcelaNombre: '',
  grupoNombre: '',
  subId: '',
  periodo: '',
  especieNombre: null,
};

describe('contracts · gps-defaults', () => {
  it('GPS_CAPTURE_FREQUENCY_DEFAULT / GPS_CAPTURE_REQUIRED_DEFAULT coinciden con el contrato', () => {
    const contrato = leerContrato('gps-defaults.json');
    expect(GPS_CAPTURE_FREQUENCY_DEFAULT).toBe(contrato.frequency);
    expect(GPS_CAPTURE_REQUIRED_DEFAULT).toBe(contrato.required);
  });
});

describe('contracts · species-sentinel', () => {
  it('UNKNOWN_SPECIES_CODE coincide con el contrato', () => {
    const contrato = leerContrato('species-sentinel.json');
    expect(UNKNOWN_SPECIES_CODE).toBe(contrato.code);
  });
});

describe('contracts · export-columns', () => {
  it('CSV_HEADER y el orden de rowToExcel coinciden con el contrato', () => {
    const contrato = leerContrato('export-columns.json') as { headers: string[] };
    expect(CSV_HEADER.trim().split(',')).toEqual(contrato.headers);
    expect(Object.keys(rowToExcel(FILA_EXPORT_VACIA))).toEqual(contrato.headers);
  });
});

describe('contracts · roles', () => {
  it('ROL coincide con el contrato', () => {
    const contrato = leerContrato('roles.json');
    expect(ROL).toEqual(contrato);
  });
});

describe('contracts · estados', () => {
  it('ESTADO_PLANTACION coincide con el contrato', () => {
    const contrato = leerContrato('estados.json');
    expect(ESTADO_PLANTACION).toEqual(contrato);
  });
});
