import { readFileSync } from 'node:fs';
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../gpsDefaults';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../photoDefaults';
import { ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { ESTADO_PLANTACION } from '../../queries/plantationQueries';
import { ROL } from '../../repositories/profileRepository';
import { ENCABEZADO_CSV } from '../../services/exportarCsv';
import { COLUMNAS_XLSX } from '../../services/exportarXlsx';
import { CODIGO_PLANTACION, idDeArbol } from '../codigoPlantacion';
import { puedeCambiarEspecie } from '../../screens/datos/cambioDeEspecie';
import type { EstadoPlantacion } from '../../queries/plantationQueries';
import type { Rol } from '../../repositories/profileRepository';

// `import.meta.url` va a una variable antes de `new URL(...)`: pasado inline, Vite lo reconoce
// como el patrón de asset estático y lo reescribe a una URL http del dev server (no file://).
const URL_MODULO = import.meta.url;

/** Lee un contrato de `contracts/` y descarta `_comment` (no forma parte de los valores a comparar). */
function leerContrato(nombre: string): Record<string, unknown> {
  const contrato = JSON.parse(
    readFileSync(new URL(`../../../../contracts/${nombre}`, URL_MODULO), 'utf8'),
  );
  delete contrato._comment;
  return contrato;
}

describe('contracts · gps-defaults', () => {
  it('GPS_CAPTURE_FREQUENCY_DEFAULT / GPS_CAPTURE_REQUIRED_DEFAULT coinciden con el contrato', () => {
    const contrato = leerContrato('gps-defaults.json');
    expect(GPS_CAPTURE_FREQUENCY_DEFAULT).toBe(contrato.frequency);
    expect(GPS_CAPTURE_REQUIRED_DEFAULT).toBe(contrato.required);
  });
});

describe('contracts · photo-defaults', () => {
  it('PHOTO_CAPTURE_ALL_TREES_DEFAULT coincide con el contrato', () => {
    const contrato = leerContrato('photo-defaults.json');
    expect(PHOTO_CAPTURE_ALL_TREES_DEFAULT).toBe(contrato.allTrees);
  });
});

describe('contracts · species-sentinel', () => {
  it('ESPECIE_SIN_IDENTIFICAR coincide con el contrato', () => {
    const contrato = leerContrato('species-sentinel.json');
    expect(ESPECIE_SIN_IDENTIFICAR).toBe(contrato.code);
  });
});

describe('contracts · export-columns', () => {
  it('ENCABEZADO_CSV y COLUMNAS_XLSX coinciden con el orden del contrato', () => {
    const contrato = leerContrato('export-columns.json') as { headers: string[] };
    expect(ENCABEZADO_CSV.split(',')).toEqual(contrato.headers);
    expect(COLUMNAS_XLSX.map((columna) => columna.header)).toEqual(contrato.headers);
  });
});

describe('contracts · roles', () => {
  it('los valores de ROL coinciden con el contrato (las claves usan PascalCase propio del código)', () => {
    const contrato = leerContrato('roles.json');
    expect(Object.values(ROL).sort()).toEqual(Object.values(contrato).sort());
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
    const contrato = leerContrato('codigo-plantacion.json');
    expect(CODIGO_PLANTACION).toEqual(contrato);
  });
});

type CasoDePermiso = {
  rol: Rol;
  activo: boolean;
  estado: EstadoPlantacion;
  archivada: boolean;
  permitido: boolean;
};

const ARCHIVADA_EN = '2026-01-01T00:00:00Z';

const describirCaso = (caso: CasoDePermiso) =>
  `${caso.rol} ${caso.activo ? 'activo' : 'inactivo'}, ${caso.estado}${caso.archivada ? ' archivada' : ''}`;

describe('contracts · permisos-edicion', () => {
  const { casos } = leerContrato('permisos-edicion.json').web as { casos: CasoDePermiso[] };

  it('trae casos', () => expect(casos.length).toBeGreaterThan(0));

  it.each(casos.map((caso) => [describirCaso(caso), caso] as const))(
    'puedeCambiarEspecie: %s',
    (_, caso) => {
      const plantacion = { estado: caso.estado, archivadaEn: caso.archivada ? ARCHIVADA_EN : null };
      expect(puedeCambiarEspecie({ rol: caso.rol, activo: caso.activo }, plantacion)).toBe(
        caso.permitido,
      );
    },
  );
});

describe('contracts · sub-id', () => {
  type VectorIdArbol = { subId: string; codigoPlantacion: string | null; idArbol: string };
  const { idArbol: vectores } = leerContrato('sub-id.json') as { idArbol: VectorIdArbol[] };

  it('trae vectores de ID de árbol', () => expect(vectores.length).toBeGreaterThan(0));

  it.each(vectores.map((vector) => [vector.idArbol, vector] as const))(
    'idDeArbol arma %s',
    (_, vector) => {
      expect(idDeArbol(vector.subId, vector.codigoPlantacion)).toBe(vector.idArbol);
    },
  );
});
