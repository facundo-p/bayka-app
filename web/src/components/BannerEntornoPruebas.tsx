import { useLayoutEffect } from 'react';
import { ES_ENTORNO_DE_PRUEBAS, ETIQUETA_BUILD } from '../lib/entorno';
import styles from './BannerEntornoPruebas.module.css';

/** Valor de `<html data-entorno>`: theme.css sube --alto-banner-entorno con él. */
const MARCA_ENTORNO_PRUEBAS = 'pruebas';

/** Franja fija "ENTORNO DE PRUEBAS · vX.Y.Z · commit", montada una vez en App.tsx (cubre
 *  también /login). Es dueña de la franja Y del offset: marca el documento para
 *  que sidebar y Topbar se corran; en prod no renderiza ni marca nada. */
export function BannerEntornoPruebas() {
  useLayoutEffect(() => {
    if (!ES_ENTORNO_DE_PRUEBAS) return;
    document.documentElement.dataset.entorno = MARCA_ENTORNO_PRUEBAS;
    return () => {
      delete document.documentElement.dataset.entorno;
    };
  }, []);

  if (!ES_ENTORNO_DE_PRUEBAS) return null;
  return <div className={styles.banner}>{`ENTORNO DE PRUEBAS · ${ETIQUETA_BUILD}`}</div>;
}
