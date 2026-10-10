import { Check, Copy } from 'lucide-react';
import { useCopiar } from '../hooks/useCopiar';
import { TAMANO_ICONO } from '../theme/iconos';
import { BotonIcono } from './BotonIcono';
import styles from './BotonCopiar.module.css';

export const ETIQUETA_COPIADO = 'Copiado';

interface BotonCopiarProps {
  texto: string;
  /** Nombre accesible y tooltip, ej. «Copiar ID Árbol». */
  etiqueta: string;
}

/** Copia `texto` al portapapeles; el ícono pasa a un check mientras dura la confirmación. */
export function BotonCopiar({ texto, etiqueta }: BotonCopiarProps) {
  const { copiado, copiar } = useCopiar();
  const Icono = copiado ? Check : Copy;
  return (
    <>
      <BotonIcono
        variante="fantasma"
        etiqueta={etiqueta}
        title={copiado ? ETIQUETA_COPIADO : etiqueta}
        onClick={() => copiar(texto)}
      >
        <Icono size={TAMANO_ICONO.sm} aria-hidden />
      </BotonIcono>
      <span role="status" className={styles.anuncio}>
        {copiado ? ETIQUETA_COPIADO : ''}
      </span>
    </>
  );
}
