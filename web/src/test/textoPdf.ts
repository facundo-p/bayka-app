import { inflateSync } from 'node:zlib';

/*
 * Extrae el texto de un PDF de react-pdf sin dependencias: los streams van
 * comprimidos con zlib y el texto, como ids de glifo de cada fuente embebida.
 * Cada ToUnicode los traduce; como los ids se repiten entre fuentes, cada
 * renglón se decodifica con todas y quedan las lecturas completas.
 */

const MARCA_STREAM = /stream\r?\n/g;
const FIN_STREAM = 'endstream';
const DIGITOS_GLIFO = 4;

function streamsDescomprimidos(pdf: Buffer): string[] {
  const crudo = pdf.toString('latin1');
  return [...crudo.matchAll(MARCA_STREAM)].flatMap((marca) => {
    const inicio = marca.index + marca[0].length;
    try {
      return [
        inflateSync(pdf.subarray(inicio, crudo.indexOf(FIN_STREAM, inicio))).toString('latin1'),
      ];
    } catch {
      return [];
    }
  });
}

const hexAEntero = (hex: string) => parseInt(hex, 16);
const hexAUnicode = (hex: string) => String.fromCodePoint(hexAEntero(hex));

function mapaDeCmap(cmap: string): Map<number, string> {
  const mapa = new Map<number, string>();
  for (const [, desde, hasta, destino] of cmap.matchAll(
    /<(\w+)>\s*<(\w+)>\s*(\[[^\]]*\]|<\w+>)/g,
  )) {
    const destinos = [...destino.matchAll(/<(\w+)>/g)].map(([, hex]) => hex);
    const base = hexAEntero(destinos[0]);
    for (let glifo = hexAEntero(desde); glifo <= hexAEntero(hasta); glifo++) {
      const offset = glifo - hexAEntero(desde);
      mapa.set(
        glifo,
        destinos.length > 1 ? hexAUnicode(destinos[offset]) : String.fromCodePoint(base + offset),
      );
    }
  }
  return mapa;
}

function decodificar(hex: string, mapa: Map<number, string>): string | null {
  let texto = '';
  for (let i = 0; i < hex.length; i += DIGITOS_GLIFO) {
    const caracter = mapa.get(hexAEntero(hex.slice(i, i + DIGITOS_GLIFO)));
    if (caracter === undefined) return null;
    texto += caracter;
  }
  return texto;
}

/** El contenido de cada `[...] TJ`: tramos de glifos en hex, cada uno con su ajuste de avance. */
function renglonesDe(streams: string[]): string[] {
  return streams.flatMap((s) => [...s.matchAll(/\[([^\]]*)\]\s*TJ/g)].map(([, arr]) => arr));
}

/** Los renglones que pasan `incluir`, leídos con cada fuente que los lee completos. */
function leerRenglones(pdf: Buffer, incluir: (renglon: string) => boolean): string[] {
  const streams = streamsDescomprimidos(pdf);
  const mapas = streams.filter((s) => s.includes('begincmap')).map(mapaDeCmap);
  return renglonesDe(streams)
    .filter(incluir)
    .flatMap((renglon) => {
      const hex = [...renglon.matchAll(/<(\w+)>/g)].map(([, h]) => h).join('');
      return mapas.map((mapa) => decodificar(hex, mapa)).filter((texto) => texto !== null);
    });
}

/** Cada renglón dibujado, en todas las fuentes que lo pueden leer completo. */
export function textosDelPdf(pdf: Buffer): string[] {
  return leerRenglones(pdf, () => true);
}

/** Un glifo con el avance cambiado parte el TJ y deja un ajuste distinto de 0. */
const conAvanceCambiado = (renglon: string) =>
  [...renglon.matchAll(/>\s*(-?[\d.]+)/g)].some(([, ajuste]) => Number(ajuste) !== 0);

/**
 * Los renglones con glifos corridos: los que textkit justificó porque no
 * entraban en su caja, y también los de letterSpacing o kerning.
 */
export function textosJustificados(pdf: Buffer): string[] {
  return leerRenglones(pdf, conAvanceCambiado);
}
