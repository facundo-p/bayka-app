// ExportService importa expo-file-system/expo-sharing/xlsx y queries/exportQueries (que a su vez
// abre el cliente SQLite real) a nivel de módulo: mockeados igual que en tests/admin/ExportService.test.ts
// para poder importar CSV_HEADER/rowToExcel sin correr ese I/O.
jest.mock('../src/queries/exportQueries', () => ({
  getExportRows: jest.fn(),
}));
jest.mock('../src/services/sync/catalogoDeEspecies', () => ({
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
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT, PHOTO_CAPTURE_REQUIRED_DEFAULT } from '../src/constants/photoCapture';
import { UNKNOWN_SPECIES_CODE } from '../src/utils/speciesHelpers';
import { CSV_HEADER, rowToExcel } from '../src/services/ExportService';
import { ROL } from '../src/constants/roles';
import { ESTADO_PLANTACION, ESTADO_GRUPO, type EstadoPlantacion } from '../src/constants/estados';
import { getCambioDeEspecie, seOfreceCambioDeEspecie } from '../src/utils/permisosDeEdicion';
import { idDeArbol } from '../src/utils/codigoDePlantacion';
import { CODIGO_PLANTACION } from '../src/constants/codigoPlantacion';
import type { ExportRow } from '../src/queries/exportQueries';
import { leerContrato } from './helpers/contratos';

const FILA_EXPORT_VACIA: ExportRow = {
  idArbol: '',
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

describe('contracts · photo-defaults', () => {
  it('PHOTO_CAPTURE_ALL_TREES_DEFAULT / PHOTO_CAPTURE_REQUIRED_DEFAULT coinciden con el contrato', () => {
    const contrato = leerContrato('photo-defaults.json');
    expect(PHOTO_CAPTURE_ALL_TREES_DEFAULT).toBe(contrato.allTrees);
    expect(PHOTO_CAPTURE_REQUIRED_DEFAULT).toBe(contrato.required);
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

describe('contracts · codigo-plantacion', () => {
  it('CODIGO_PLANTACION coincide con el contrato (que es también el CHECK de la base)', () => {
    expect(CODIGO_PLANTACION).toEqual(leerContrato('codigo-plantacion.json'));
  });
});

describe('contracts · permisos-edicion', () => {
  type CasoDeLaApp = { estado: EstadoPlantacion; archivada: boolean; permitido: boolean };
  const { casos } = leerContrato('permisos-edicion.json').app as { casos: CasoDeLaApp[] };

  it('trae casos permitidos y rechazados', () => {
    expect(new Set(casos.map((caso) => caso.permitido))).toEqual(new Set([true, false]));
  });

  // Las dimensiones que la app no comparte con sync_subgroup quedan fijas: el
  // creador, con el grupo activo.
  it.each(casos.map((caso) => [`${caso.estado}${caso.archivada ? ' archivada' : ''}`, caso] as const))(
    'getCambioDeEspecie: %s',
    (_, caso) => {
      const cambio = getCambioDeEspecie({
        plantacion: {
          estado: caso.estado,
          archivadaEn: caso.archivada ? '2026-01-01T00:00:00Z' : null,
          eliminadaEnServidorEn: null,
        },
        subgroupEstado: ESTADO_GRUPO.activa,
        isCreator: true,
      });
      expect(seOfreceCambioDeEspecie(cambio)).toBe(caso.permitido);
    },
  );
});

describe('contracts · sub-id', () => {
  type VectorIdArbol = { subId: string; codigoPlantacion: string | null; idArbol: string };
  const { idArbol: vectores } = leerContrato('sub-id.json') as { idArbol: VectorIdArbol[] };

  it('trae vectores de ID de árbol', () => expect(vectores.length).toBeGreaterThan(0));

  it.each(vectores.map((v) => [v.idArbol, v] as const))('idDeArbol arma %s', (_, v) => {
    expect(idDeArbol(v.subId, v.codigoPlantacion)).toBe(v.idArbol);
  });
});
