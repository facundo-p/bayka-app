/** Lo que se decide con las mediciones ya tomadas: vistas vacías y cards colapsadas. */
import { claveCelda } from './config.mjs';

/* Menos texto visible que esto y la pantalla no se renderizó: la de contenido
   más pobre (novedades) pasa largamente de acá.
   El piso está calibrado contra pantallas CON chrome —sidebar y topbar ya suman
   ~150 caracteres—, porque el caso que motivó el check era justamente contenido
   en blanco con el marco puesto. */
const MINIMO_TEXTO_PANTALLA = 200;

/* Piso de lo que se mide sin chrome alrededor: un diálogo, o una pantalla de
   autenticación que no monta el layout. Son legítimamente cortos —el más chico
   son un título, tres etiquetas y dos botones— y con el piso general darían
   VACIA estando perfectos. Un render fallido ahí deja sólo el banner (~26). */
const MINIMO_TEXTO_SIN_CHROME = 40;

const TAMANO_COLAPSO_DURO = 40;
const FRACCION_COLAPSO = 0.4;

/** La escala de `marcarColapsadas` entre dos mediciones tomadas al mismo ancho. */
const MISMO_ANCHO = 1;

/**
 * ¿Lo medido no renderizó? Una pantalla en blanco da cero en todos los checks
 * y se lee como impecable: sin esto, un crash de render se reporta como una
 * fila limpia, que es lo que pasó con el mapa y `.not(is,null)`.
 *
 * `acotada`: se midió un diálogo o una pantalla que no monta el layout, y el
 * piso de la app entera no aplica.
 */
export function estaVacia(medicion, acotada = false) {
  return medicion.textoVisible < (acotada ? MINIMO_TEXTO_SIN_CHROME : MINIMO_TEXTO_PANTALLA);
}

/**
 * Marca `nColapsadas` en cada ancho de `pantalla`. Cada card se compara contra
 * sí misma en `anchos[0]`, el más grande: un umbral fijo no sirve porque hay
 * panels que miden 139px en todos los anchos porque son así de bajos.
 */
export function marcarColapsadas(informe, pantalla, anchos) {
  const referencia = informe[claveCelda(pantalla, anchos[0])]?.cards ?? {};
  for (const ancho of anchos) {
    const f = informe[claveCelda(pantalla, ancho)];
    if (f && !f.error) marcarCelda(f, referencia, ancho / anchos[0]);
  }
}

function marcarCelda(medicion, referencia, escala) {
  const colapsadas = detectarColapsadas(medicion.cards ?? {}, referencia, escala);
  medicion.nColapsadas = colapsadas.length;
  medicion.detalle.colapsadas = colapsadas;
}

function detectarColapsadas(cards, referencia, escala) {
  return Object.entries(cards)
    .filter(([clase, card]) => estaColapsada(card, referencia[clase], escala))
    .map(([clase, card]) => ({
      el: clase,
      alto: card.h,
      ancho: card.w,
      base: referencia[clase] ?? null,
    }));
}

/**
 * Colapsada es la card que perdió el tamaño que tenía en desktop, no la que es
 * chica de nacimiento. Debajo de 40px en algún eje es colapso seguro. Por
 * debajo del 40% de su tamaño de referencia también, pero solo si el contenido
 * ya no entra: una card que se ajusta a su contenido y se ve entera no está rota.
 *
 * `escala` lleva el ancho de referencia al ancho medido: a 360 cualquier card a
 * ancho completo mide menos del 40% de lo que medía a 1920. El alto no se
 * escala: la ventana tiene siempre el mismo alto.
 */
function estaColapsada(card, base, escala) {
  const duro = card.h < TAMANO_COLAPSO_DURO || card.w < TAMANO_COLAPSO_DURO;
  const relativo =
    base != null &&
    card.desborda &&
    (card.h < base.h * FRACCION_COLAPSO || card.w < base.w * escala * FRACCION_COLAPSO);
  return duro || relativo;
}

/** Corre el clasificador real de colapso sobre una medición suelta, contra una referencia de su mismo ancho. */
export function clasificarSuelta(referencia, medicion) {
  marcarCelda(medicion, referencia.cards ?? {}, MISMO_ANCHO);
  return medicion;
}
