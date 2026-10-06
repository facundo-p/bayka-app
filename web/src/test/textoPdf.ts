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

/** Cada renglón dibujado, en todas las fuentes que lo pueden leer completo. */
export function textosDelPdf(pdf: Buffer): string[] {
  const streams = streamsDescomprimidos(pdf);
  const mapas = streams.filter((s) => s.includes('begincmap')).map(mapaDeCmap);
  const renglones = streams.flatMap((s) =>
    [...s.matchAll(/\[([^\]]*)\]\s*TJ/g)].map(([, arr]) => arr),
  );
  return renglones.flatMap((renglon) => {
    const hex = [...renglon.matchAll(/<(\w+)>/g)].map(([, h]) => h).join('');
    return mapas.map((mapa) => decodificar(hex, mapa)).filter((texto) => texto !== null);
  });
}
