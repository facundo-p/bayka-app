import { Check, Copy } from 'lucide-react';
import { useCopiar } from '../hooks/useCopiar';
import { TAMANO_ICONO } from '../theme/iconos';
import { BotonIcono } from './BotonIcono';

export const ETIQUETA_COPIADO = 'Copiado';

interface BotonCopiarProps {
  texto: string;
  /** Nombre accesible y tooltip, ej. «Copiar ID Árbol». */
  etiqueta: string;
}

/** Copia `texto` al portapapeles; el ícono pasa a un check mientras dura la confirmación. */
export function BotonCopiar({ texto, etiqueta }: BotonCopiarProps) {
  const { copiado, copiar } = useCopiar();
  const nombre = copiado ? ETIQUETA_COPIADO : etiqueta;
  const Icono = copiado ? Check : Copy;
  return (
    <BotonIcono variante="fantasma" etiqueta={nombre} title={nombre} onClick={() => copiar(texto)}>
      <Icono size={TAMANO_ICONO.sm} aria-hidden />
    </BotonIcono>
  );
}
