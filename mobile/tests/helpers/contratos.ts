import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Lee un contrato de `contracts/` y descarta `_comment` (no forma parte de los valores a comparar). */
export function leerContrato(nombre: string): Record<string, unknown> {
  const contrato = JSON.parse(
    readFileSync(path.resolve(__dirname, '../../../contracts', nombre), 'utf8'),
  );
  delete contrato._comment;
  return contrato;
}
