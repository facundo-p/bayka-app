import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambiosDePlugins, cambiosNativos, commitSinSufijo } from './lib/nativos.mjs';

const nativos = new Set(['@react-native-community/datetimepicker', 'expo-camera', 'expo-sqlite']);
const esNativo = (nombre) => (nombre === 'quitado-sin-instalar' ? null : nativos.has(nombre));

test('cambiosNativos: el caso de #677, un módulo nativo nuevo que el APK no tiene', () => {
  const base = { 'expo-sqlite': '~16.0.10', zod: '^3.0.0' };
  const actual = { ...base, '@react-native-community/datetimepicker': '8.4.4' };
  assert.deepEqual(cambiosNativos(base, actual, esNativo), [
    {
      nombre: '@react-native-community/datetimepicker',
      cambio: 'agregado',
      hasta: '8.4.4',
      nativo: true,
    },
  ]);
});

test('cambiosNativos: deja afuera las dependencias JS puras', () => {
  assert.deepEqual(
    cambiosNativos({ zod: '^3.0.0' }, { zod: '^3.1.0', dayjs: '1.0.0' }, esNativo),
    [],
  );
});

test('cambiosNativos: quitado, cambio de versión y quitado sin instalar', () => {
  const base = {
    'expo-camera': '~17.0.10',
    'expo-sqlite': '~16.0.10',
    'quitado-sin-instalar': '1.0.0',
  };
  const actual = { 'expo-sqlite': '~16.0.11' };
  assert.deepEqual(cambiosNativos(base, actual, esNativo), [
    { nombre: 'expo-camera', cambio: 'quitado', desde: '~17.0.10', nativo: true },
    {
      nombre: 'expo-sqlite',
      cambio: 'version',
      desde: '~16.0.10',
      hasta: '~16.0.11',
      nativo: true,
    },
    { nombre: 'quitado-sin-instalar', cambio: 'quitado', desde: '1.0.0', nativo: null },
  ]);
});

test('cambiosDePlugins: compara nombres, con o sin opciones', () => {
  const base = ['expo-router', ['expo-camera', { cameraPermission: 'x' }]];
  const actual = [
    ['expo-camera', { cameraPermission: 'y' }],
    '@react-native-community/datetimepicker',
  ];
  assert.deepEqual(cambiosDePlugins(base, actual), {
    agregados: ['@react-native-community/datetimepicker'],
    quitados: ['expo-router'],
  });
  assert.deepEqual(cambiosDePlugins(undefined, []), { agregados: [], quitados: [] });
});

test('commitSinSufijo: saca solo el -dirty final', () => {
  assert.equal(commitSinSufijo('ffafce1-dirty'), 'ffafce1');
  assert.equal(commitSinSufijo('ffafce1'), 'ffafce1');
});
