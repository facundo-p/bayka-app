import { Link } from 'react-router';
import type { ReactNode } from 'react';
import styles from './CabeceraSeccion.module.css';

interface CabeceraSeccionProps {
  /** Rótulo de la sección que contiene a esta pantalla ("Plantaciones", "Organización"). */
  raiz: string;
  /** Ruta del rótulo; sin ella queda como texto plano (no toda sección tiene pantalla). */
  raizA?: string;
  titulo: string;
  /** Línea de contexto a la derecha del título (recuento, período). */
  meta?: string;
  /** Se intercala entre el separador y el título (ej. el badge de estado). */
  children?: ReactNode;
}

/**
 * Cabecera de una fila donde el breadcrumb ES el título: vive dentro de la
 * Topbar compacta y reemplaza al bloque título + subtítulo apilados.
 */
export function CabeceraSeccion({ raiz, raizA, titulo, meta, children }: CabeceraSeccionProps) {
  return (
    <nav className={styles.cabecera} aria-label="Migas de navegación">
      {raizA ? (
        <Link to={raizA} className={styles.raiz}>
          {raiz}
        </Link>
      ) : (
        <span className={styles.raiz}>{raiz}</span>
      )}
      <span className={styles.separador} aria-hidden>
        /
      </span>
      {children}
      <h1 className={styles.titulo} aria-current="page">
        {titulo}
      </h1>
      {meta && <span className={styles.meta}>{meta}</span>}
    </nav>
  );
}
