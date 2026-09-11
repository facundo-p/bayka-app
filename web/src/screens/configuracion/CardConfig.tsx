import type { ReactNode } from 'react';
import { Cargando, ErrorConReintento } from '../../components';
import {
  algunaCargando,
  algunaConError,
  reintentarTodas,
  type EstadoConsulta,
} from '../../lib/consultas';
import { CabeceraConfig } from './CabeceraConfig';
import styles from './SeccionesConfig.module.css';

interface CardConfigProps {
  className: string;
  titulo: string;
  subtitulo: string;
  /** Mientras alguna carga o falla, la cabecera va sin chip ni acciones. */
  consultas: EstadoConsulta[];
  mensajeError: string;
  /** El contenido listo, que arma su propia cabecera completa. */
  children: ReactNode;
}

/** `ErrorConReintento` no tiene padding propio y acá cuelga de la card. */
function BloqueError({ consultas, mensaje }: { consultas: EstadoConsulta[]; mensaje: string }) {
  return (
    <div className={styles.bloqueEstado}>
      <ErrorConReintento mensaje={mensaje} onReintentar={reintentarTodas(consultas)} />
    </div>
  );
}

/** Card con lista de Configuración: cabecera + carga, error o contenido. */
export function CardConfig({
  className,
  consultas,
  mensajeError,
  children,
  ...textos
}: CardConfigProps) {
  const cabecera = <CabeceraConfig {...textos} />;
  return (
    <section className={className}>
      {algunaCargando(consultas) && (
        <>
          {cabecera}
          <Cargando />
        </>
      )}
      {algunaConError(consultas) && (
        <>
          {cabecera}
          <BloqueError consultas={consultas} mensaje={mensajeError} />
        </>
      )}
      {children}
    </section>
  );
}
