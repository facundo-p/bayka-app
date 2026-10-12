import { View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

/**
 * react-pdf recorre el documento a lo ancho con una cola que vacía con
 * `Array.shift()`. Con miles de filas a la misma profundidad la cola pasa los
 * miles de nodos, cada `shift` la copia entera y el armado se vuelve cuadrático:
 * 7.000 filas tardaban 35 s en vez de 8. Cada hoja anidada a una profundidad
 * distinta reparte la cola en tramos chicos. Baja la constante, no el orden:
 * 14.000 filas tardan 26 s.
 */
export const NIVELES_DE_ESCALON = 32;

/** Envuelve el contenido en `nivel` vistas vacías, que no cambian el layout. */
export function Escalon({ nivel, children }: { nivel: number; children: ReactNode }) {
  if (nivel <= 0) return children;
  return (
    <View>
      <Escalon nivel={nivel - 1}>{children}</Escalon>
    </View>
  );
}
