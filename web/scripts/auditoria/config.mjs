/**
 * Qué mide la auditoría y contra qué: vistas, anchos, métricas y los contratos
 * con la app (servidor demo, CSS Modules) que el script asume.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ESCALA from '../../src/theme/breakpoints.json' with { type: 'json' };

const AQUI = dirname(fileURLToPath(import.meta.url));
export const BASELINE = join(AQUI, 'baseline.json');
export const CAPTURAS = join(AQUI, '..', '..', '.auditoria');
export const MEDIR_NAVEGADOR = join(AQUI, 'medir.navegador.js');

/** El de `npm run dev:demo`, que vite.demo.config.ts fija con `strictPort`. */
export const PUERTO_DEMO = 5199;
export const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PUERTO_DEMO}`;

export const ALTO_VENTANA = 900;

/**
 * Pantallas reales: al menos una por banda de la escala, más los extremos. 390
 * es el teléfono más común, y ahí la auditoría vio las tabs del detalle encima
 * de la miga. A 430 la miga ya estaba aplastada en 66px, pero sin texto encima
 * de otro texto, y la celda salía limpia (#825).
 */
const PANTALLAS = [1920, 1440, 1280, 1024, 768, 430, 390, 360];

/**
 * Los escalones que cambian la estructura (sidebar horizontal, tablas sin
 * columnas secundarias) se miden además en el borde.
 */
const BORDES = [ESCALA.ancho.tablet, ESCALA.ancho.movil];

export const ANCHOS = Object.freeze([...PANTALLAS, ...BORDES].sort((a, b) => b - a));

/** Para las vistas que solo existen en teléfono, como la hoja de filtros. */
export const ANCHOS_MOVIL = Object.freeze(ANCHOS.filter((a) => a <= ESCALA.ancho.movil));

/** Y las que solo existen arriba del teléfono, como el panel de filtros. */
export const ANCHOS_ESCRITORIO = Object.freeze(ANCHOS.filter((a) => a > ESCALA.ancho.movil));

export const claveCelda = (pantalla, ancho) => `${pantalla}@${ancho}`;

/** Clase de un CSS Module: Vite la renombra a `_<nombre>_<hash>`. */
export const claseModulo = (nombre) => `[class*="_${nombre}_"]`;

export const SELECTOR_DIALOGO = '[role="dialog"]';

/** La miga de la topbar, por el nombre accesible que le ponen `Breadcrumb` y `CabeceraSeccion`. */
export const SELECTOR_MIGA = 'nav[aria-label="Migas de navegación"]';

/** Contenedores que pueden quedar en 0px al perder el contexto flex (`H`). */
export const SELECTOR_CARDS = [
  claseModulo('panel'),
  claseModulo('mapa'),
  claseModulo('cardTabla'),
  '.leaflet-container',
].join(', ');

/** La define el fake de `src/demo/datos.ts`. */
const PLANTACION_DEMO = 'p1';
/** Finalizada y archivada: dos badges en la miga, la más ancha del demo. */
const PLANTACION_ARCHIVADA_DEMO = 'p7';

export const RUTA = Object.freeze({
  plantaciones: '/plantaciones',
  dashboard: `/plantaciones/${PLANTACION_DEMO}`,
  dashboardArchivada: `/plantaciones/${PLANTACION_ARCHIVADA_DEMO}`,
  datosParcelas: `/plantaciones/${PLANTACION_DEMO}/datos/parcelas`,
  datosGrupos: `/plantaciones/${PLANTACION_DEMO}/datos/grupos`,
  datosArboles: `/plantaciones/${PLANTACION_DEMO}/datos/arboles`,
  configuracion: `/plantaciones/${PLANTACION_DEMO}/configuracion`,
  especies: '/especies',
  usuarios: '/usuarios',
  novedades: '/novedades',
  // El cliente falso siempre tiene sesión y `/login` redirigiría al listado.
  loginSinSesion: '/login?sinSesion=1',
  password: '/establecer-password',
});

export const MODAL_NUEVA_PLANTACION = Object.freeze({
  ruta: RUTA.plantaciones,
  abrir: 'Nueva plantación',
  raiz: SELECTOR_DIALOGO,
});

/** Valor de `abrir` que despliega todos los `<details>` en vez de clickear un botón. */
export const TODOS_LOS_DETAILS = Symbol('todos los <details>');

/**
 * Qué se mide. `abrir` es el nombre accesible de un botón que se clickea
 * después de cargar, o TODOS_LOS_DETAILS: plegado, el contenido de un
 * `<details>` no se pinta y no se mide. `raiz` acota la medición a ese
 * subárbol: con un modal abierto, el texto de la página que queda detrás del
 * overlay se pisa con el del diálogo y O daría decenas de solapes que nadie ve.
 * `sinChrome` marca las que no montan el layout, para el piso de VACIA.
 * `anchos` acota la vista a esos anchos: sin eso, una pantalla que solo existe
 * en teléfono se pasa diez segundos esperando un botón que a 1920 no está.
 */
export const VISTAS = Object.freeze([
  { pantalla: 'plantaciones', ruta: RUTA.plantaciones },
  { pantalla: 'dashboard', ruta: RUTA.dashboard },
  // Con un solo badge, la miga aplastada por las tabs no pinta texto encima de
  // nada y `dashboard` sale limpia; con dos, el badge queda bajo las tabs (#825).
  // Solo en teléfono: arriba de 600 la base de la miga la protege.
  { pantalla: 'dashboard-archivada', ruta: RUTA.dashboardArchivada, anchos: ANCHOS_MOVIL },
  { pantalla: 'datos-parcelas', ruta: RUTA.datosParcelas },
  { pantalla: 'datos-grupos', ruta: RUTA.datosGrupos },
  { pantalla: 'datos-arboles', ruta: RUTA.datosArboles },
  { pantalla: 'configuracion', ruta: RUTA.configuracion },
  { pantalla: 'especies', ruta: RUTA.especies },
  { pantalla: 'usuarios', ruta: RUTA.usuarios },
  { pantalla: 'novedades', ruta: RUTA.novedades },
  // Los pasos de prueba de cada ítem, desplegados.
  { pantalla: 'novedades-pasos', ruta: RUTA.novedades, abrir: TODOS_LOS_DETAILS },
  // Fuera del gate de sesión: se ven sin el sidebar.
  { pantalla: 'login', ruta: RUTA.loginSinSesion, sinChrome: true },
  { pantalla: 'password', ruta: RUTA.password, sinChrome: true },
  // El formulario más grande de la app y el más chico: los dos extremos del modal.
  { pantalla: 'modal-plantacion', ...MODAL_NUEVA_PLANTACION },
  {
    pantalla: 'modal-usuario',
    ruta: RUTA.usuarios,
    abrir: 'Agregar usuario',
    raiz: SELECTOR_DIALOGO,
  },
  // La hoja de filtros: superficie nueva y solo de teléfono, así que ninguna
  // otra vista la mide.
  {
    pantalla: 'modal-filtros',
    ruta: RUTA.plantaciones,
    abrir: 'Filtros',
    raiz: SELECTOR_DIALOGO,
    anchos: ANCHOS_MOVIL,
  },
  // El panel de filtros, que es la hoja arriba de 600: un popover anclado al
  // botón. Plantaciones es la que tiene más filtros.
  {
    pantalla: 'panel-filtros',
    ruta: RUTA.plantaciones,
    abrir: 'Filtros',
    raiz: SELECTOR_DIALOGO,
    anchos: ANCHOS_ESCRITORIO,
  },
]);

/**
 * @typedef {object} Metrica
 * @property {string} campo    Campo de la medición y del baseline.
 * @property {string} letra    Cómo se lee en la celda.
 * @property {string} leyenda
 * @property {string} [detalle] Lista de `medicion.detalle` que se imprime si empeora.
 * @property {true} [sinValor] La celda muestra la letra sola, sin el número.
 */

/**
 * Las métricas de la matriz, en el orden en que se leen en cada celda. Todas
 * son duras: si una sube respecto del baseline, la corrida falla. Las blandas
 * (`nTruncados`) no están acá porque no deciden nada.
 *
 * @type {readonly Metrica[]}
 */
export const METRICAS = Object.freeze([
  { campo: 'scrollH', letra: 'S', leyenda: 'scroll horizontal' },
  { campo: 'nSolapes', letra: 'O', leyenda: 'solapes', detalle: 'solapes' },
  { campo: 'nRecortados', letra: 'R', leyenda: 'texto recortado', detalle: 'recortados' },
  {
    campo: 'nFueraViewport',
    letra: 'X',
    leyenda: 'fuera del viewport',
    detalle: 'fueraViewport',
  },
  {
    campo: 'nVacia',
    letra: 'VACIA',
    leyenda: 'la pantalla no renderizó nada',
    sinValor: true,
  },
  { campo: 'nDesparejos', letra: 'D', leyenda: 'controles desparejos', detalle: 'desparejos' },
  { campo: 'nColapsadas', letra: 'H', leyenda: 'card colapsada', detalle: 'colapsadas' },
  {
    campo: 'nTablasRecortadas',
    letra: 'T',
    leyenda: 'tabla que recorta sin scrollear',
    detalle: 'tablasRecortadas',
  },
  {
    campo: 'nDesbordesLaterales',
    letra: 'L',
    leyenda: 'texto que se sale de su caja',
    detalle: 'desbordesLaterales',
  },
]);

export const DUROS = Object.freeze(METRICAS.map((m) => m.campo));
