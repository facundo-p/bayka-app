import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// vitest corre con cwd en `web/`; los .css que importan son todos los de src/.
const RAIZ = join(process.cwd(), 'src');

function rutasCss(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return rutasCss(ruta);
    return entrada.name.endsWith('.css') ? [ruta] : [];
  });
}

export interface ArchivoCss {
  /** Absoluta, para resolver los `composes … from` relativos. */
  absoluta: string;
  /** Desde `src/`, para los mensajes. */
  ruta: string;
  texto: string;
}

/** Todos los .css de `src/`, leídos una vez. */
export function archivosCss(): ArchivoCss[] {
  return rutasCss(RAIZ).map((absoluta) => ({
    absoluta,
    ruta: absoluta.slice(RAIZ.length),
    texto: readFileSync(absoluta, 'utf8'),
  }));
}
