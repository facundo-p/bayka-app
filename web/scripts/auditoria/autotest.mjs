/**
 * Un check que no puede disparar nunca reporta cero y parece una app impecable.
 * Esto le inyecta a una pantalla limpia cada defecto que el script dice cazar y
 * exige que lo reporte, y que calle sin él. Es la única forma de distinguir "no
 * hay defectos" de "el check está muerto".
 */
import { clasificarSuelta, estaVacia } from './clasificar.mjs';
import { MODAL_NUEVA_PLANTACION, RUTA, SELECTOR_DIALOGO, claseModulo } from './config.mjs';
import { conPagina, medirPagina } from './navegacion.mjs';

/** Lo que tarda en aplicarse el CSS inyectado. */
const ESPERA_ESTILO_MS = 300;
const ANCHO_COBERTURA = 1440;

const CASOS_AUTOTEST = [
  // La ruta y el ancho importan: hace falta una tabla que REALMENTE desborde su
  // contenedor, si no la inyección no rompe nada y el check pasa sin ejercitarse.
  // A 600 las tablas entran exactas desde que sueltan columnas; a 360 no.
  {
    nombre: 'T · contenedor de tabla que recorta en vez de scrollear',
    ruta: RUTA.plantaciones,
    ancho: 360,
    css: `${claseModulo('tablaScroll')}{overflow-x:hidden !important}`,
    espera: (r) => r.nTablasRecortadas > 0,
  },
  {
    nombre: 'T · celdas apretadas hasta recortar el texto',
    ruta: RUTA.plantaciones,
    ancho: 360,
    css: 'table{table-layout:fixed !important} td,th{overflow:hidden !important}',
    espera: (r) => r.nTablasRecortadas > 0,
  },
  {
    nombre: 'H · card aplastada a cero',
    ruta: RUTA.dashboard,
    ancho: 1920,
    css: `${claseModulo('panel')}{height:0 !important;min-height:0 !important}`,
    // Pasa por marcarColapsadas, no por una regla inline: la rama relativa
    // (fracción + desborda) es la que produce la mayoría de los hits reales.
    clasificar: true,
    espera: (r) => r.nColapsadas > 0,
  },
  {
    nombre: 'H · card que pierde el alto y deja contenido afuera',
    ruta: RUTA.dashboard,
    ancho: 1920,
    // `min-height:0` va sí o sí: los `min-height` de las cards le ganan al
    // max-height, y sin anularlos la inyección no rompe nada.
    css:
      `${claseModulo('panel')}{min-height:0 !important;max-height:60px !important;` +
      'overflow:hidden !important}',
    clasificar: true,
    espera: (r) => r.nColapsadas > 0,
  },
  {
    nombre: 'H · card que encoge pero se ve entera NO cuenta',
    ruta: RUTA.especies,
    ancho: 1920,
    css: `${claseModulo('cardTabla')}{flex:0 0 auto !important}`,
    clasificar: true,
    espera: (r) => r.nColapsadas === 0,
    esperaLimpio: (r) => r.nColapsadas === 0,
  },
  {
    nombre: 'O · dos textos encimados',
    ruta: RUTA.especies,
    ancho: 1920,
    // Estructural y no coordenadas fijas: un `top/left` a mano deja de pisar
    // nada en cuanto el layout se mueve, y el check pasa a estar sin ejercer.
    css:
      `${claseModulo('barra')}{display:grid !important}` +
      ` ${claseModulo('barra')} > *{grid-area:1/1 !important;justify-self:start !important;` +
      'margin:0 !important}',
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'O · botón con ícono encima de un título',
    ruta: RUTA.especies,
    ancho: 1920,
    // El caso que el check no veía: el texto vive en un elemento con hijos.
    css: 'button{position:fixed !important;top:100px !important;left:320px !important;z-index:99}',
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'O · dos textos apilados en la misma celda de grilla',
    ruta: RUTA.usuarios,
    ancho: 1440,
    // Estructural, no un position:fixed con coordenadas: es el caso que
    // destapó que el check ignoraba los nodos de texto largos.
    css:
      `${claseModulo('pieCard')}{display:grid !important}` +
      ` ${claseModulo('pieCard')} > *{grid-area:1/1 !important}`,
    espera: (r) => r.nSolapes > 0,
  },
  {
    nombre: 'R · texto recortado sin aviso',
    ruta: RUTA.especies,
    ancho: 1920,
    // Mismo apretón que el caso del ellipsis, pero sin `text-overflow`: acá
    // no hay nada que le diga al usuario que falta texto.
    css:
      `${claseModulo('recuento')}{display:block !important;width:40px !important;` +
      'overflow:hidden !important;white-space:nowrap !important}',
    espera: (r) => r.nRecortados > 0,
  },
  {
    nombre: 'X · control fuera del viewport',
    ruta: RUTA.especies,
    ancho: 1920,
    css: `${claseModulo('barra')} button{position:relative !important;left:3000px !important}`,
    espera: (r) => r.nFueraViewport > 0,
  },
  {
    nombre: 'X · control recortado por una card que no scrollea',
    ruta: RUTA.especies,
    ancho: 1920,
    css:
      `${claseModulo('barra')}{width:120px !important;overflow:hidden !important;` +
      'flex-wrap:nowrap !important}',
    espera: (r) => r.nFueraViewport > 0,
  },
  {
    nombre: 'X · control bajo el fold de una card con scroll propio NO cuenta',
    ruta: RUTA.dashboard,
    ancho: 1024,
    // El arreglo para anchos medios: apilar y darle scroll propio al área. Los
    // controles que quedan abajo se alcanzan scrolleando esa card, aunque
    // `.shell` —que recorta sin scrollear— los vea fuera de su caja.
    css: `${claseModulo('dashboard')}{overflow-y:auto !important}`,
    espera: (r) => r.nFueraViewport === 0,
    esperaLimpio: (r) => r.nFueraViewport === 0,
  },
  {
    nombre: 'X · control alcanzable scrolleando NO cuenta',
    ruta: RUTA.usuarios,
    ancho: 1280,
    // Es el arreglo que el check T empuja: no puede contarse como regresión.
    css: 'table{min-width:1400px !important}',
    espera: (r) => r.nFueraViewport === 0,
    esperaLimpio: (r) => r.nFueraViewport === 0,
  },
  {
    nombre: 'R · truncado con ellipsis NO cuenta (sí como truncado)',
    ruta: RUTA.especies,
    ancho: 1920,
    // El arreglo correcto para un dato de largo variable: no puede subir la nota.
    css:
      `${claseModulo('recuento')}{display:block !important;width:60px !important;overflow:hidden` +
      ' !important;white-space:nowrap !important;text-overflow:ellipsis !important}',
    espera: (r) => r.nRecortados === 0 && r.nTruncados > 0,
    esperaLimpio: (r) => r.nRecortados === 0,
  },
  {
    nombre: 'O · sin ellipsis la meta del detalle se encima con las tabs',
    ruta: RUTA.dashboard,
    ancho: 1440,
    // El defecto original de #357, y su arreglo, en el mismo caso: sacándole
    // el truncado a `.meta` el check tiene que dispararse, y con el truncado
    // puesto tiene que callarse. Si midiera la caja del Range en vez de la
    // pintada, la segunda mitad fallaría.
    css: `${claseModulo('meta')}{overflow:visible !important;text-overflow:clip !important}`,
    espera: (r) => r.nSolapes > 0,
    esperaLimpio: (r) => r.nSolapes === 0,
  },
  {
    nombre: 'D · control más alto que su vecino de fila',
    ruta: RUTA.especies,
    ancho: 1920,
    // La regresión que las otras métricas no vieron: un control que pierde su
    // alto compacto no solapa, no recorta y está dentro del viewport.
    css: `${claseModulo('campo')} input{min-height:64px !important}`,
    espera: (r) => r.nDesparejos > 0,
    esperaLimpio: (r) => r.nDesparejos === 0,
  },
  {
    nombre: 'VACIA · una pantalla que no renderiza no puntúa limpio',
    ruta: RUTA.usuarios,
    ancho: 1440,
    css: 'body > * { display: none !important }',
    espera: (r) => estaVacia(r),
  },
  {
    nombre: 'S · scroll horizontal de documento',
    ruta: RUTA.especies,
    ancho: 1920,
    css: 'body::after{content:"";display:block;width:3000px;height:1px}',
    espera: (r) => r.scrollH > 0,
  },
];

/**
 * Que los checks disparen no alcanza: un check sano apuntado a la pantalla
 * equivocada reporta cero igual que uno muerto. Esto verifica que lo que la
 * matriz DICE medir sea lo que mide.
 *
 * Existe porque la fila `login` medía el listado de plantaciones: con sesión,
 * `/login` redirige, y sus celdas eran un duplicado exacto de las de
 * `plantaciones` — cobertura fantasma que puntuaba impecable.
 */
const COBERTURA = [
  {
    nombre: 'login · se mide el login, no el listado al que redirige',
    ruta: RUTA.loginSinSesion,
    vale: async (pagina) =>
      (await pagina.getByRole('button', { name: 'Ingresar' }).count()) > 0 &&
      (await pagina.locator('table').count()) === 0,
  },
  {
    nombre: 'login · con su piso propio no cuenta como pantalla vacía',
    ruta: RUTA.loginSinSesion,
    vale: async (pagina) => {
      const m = await medirPagina(pagina);
      return !estaVacia(m, true) && m.textoVisible > 0;
    },
  },
  {
    nombre: 'raiz · medir el diálogo deja afuera la página de atrás',
    ...MODAL_NUEVA_PLANTACION,
    vale: async (pagina) => {
      const dialogo = await medirPagina(pagina, SELECTOR_DIALOGO);
      const todo = await medirPagina(pagina);
      return dialogo.textoVisible > 0 && dialogo.textoVisible * 3 < todo.textoVisible;
    },
  },
  {
    nombre: 'raiz · un selector que no matchea falla en vez de medir la página',
    ruta: RUTA.plantaciones,
    vale: async (pagina) => {
      const cayoAlBody = await medirPagina(pagina, SELECTOR_DIALOGO)
        .then((m) => m.textoVisible > 0)
        .catch(() => false);
      return !cayoAlBody;
    },
  },
];

/** Corre los casos y la cobertura; devuelve el código de salida. */
export async function autotest(navegador) {
  console.log('\nAutotest de los checks:\n');
  let fallos = 0;
  for (const caso of CASOS_AUTOTEST) if (!(await verificarCaso(navegador, caso))) fallos++;
  console.log(
    fallos
      ? `\n${fallos} checks no sirven.`
      : '\nTodos los checks disparan con su defecto y callan sin él.',
  );

  console.log('\nCobertura — que cada fila mida lo que dice medir:\n');
  const fallosCobertura = await cobertura(navegador);
  if (fallosCobertura) console.log(`\n${fallosCobertura} filas no miden lo que dicen.`);

  return fallos + fallosCobertura ? 1 : 0;
}

async function verificarCaso(navegador, caso) {
  const [limpio, roto] = await medirConYSinDefecto(navegador, caso);
  const dispara = caso.espera(roto);
  // Por defecto se exige que el check calle sin el defecto; los casos que
  // verifican "esto NO debe contarse" lo redefinen.
  const calla = caso.esperaLimpio ? caso.esperaLimpio(limpio) : !caso.espera(limpio);
  const ok = dispara && calla;
  console.log(`  ${marca(ok)} ${caso.nombre}${motivoFalla(dispara, calla)}`);
  return ok;
}

function medirConYSinDefecto(navegador, caso) {
  return conPagina(navegador, caso, async (pagina) => {
    const limpio = await medirPagina(pagina);
    await pagina.addStyleTag({ content: caso.css });
    await pagina.waitForTimeout(ESPERA_ESTILO_MS);
    const roto = await medirPagina(pagina);
    if (!caso.clasificar) return [limpio, roto];
    const rotoClasificado = clasificarSuelta(limpio, roto);
    return [clasificarSuelta(limpio, limpio), rotoClasificado];
  });
}

async function cobertura(navegador) {
  let fallos = 0;
  for (const caso of COBERTURA) {
    const vista = { ancho: ANCHO_COBERTURA, ...caso };
    const ok = await conPagina(navegador, vista, caso.vale).catch(() => false);
    if (!ok) fallos++;
    console.log(`  ${marca(ok)} ${caso.nombre}`);
  }
  return fallos;
}

function marca(ok) {
  return ok ? 'ok  ' : 'FALLA';
}

function motivoFalla(dispara, calla) {
  if (!dispara) return ' (NO dispara)';
  return calla ? '' : ' (también sin el defecto)';
}
