import { useEffect } from 'react';
import novedadesRaw from '../../../NOVEDADES.md?raw';
import { Card, EmptyState, Topbar } from '../components';
import { VERSION_APP } from '../lib/entorno';
import { parsearNovedades } from '../lib/parsearNovedades';
import { marcarNovedadesVistas } from '../hooks/useNovedadesNoVistas';
import styles from './NovedadesScreen.module.css';

// El archivo se hornea en el build: sin fetch, sin estado de carga. Si faltara,
// el build falla — que es lo que queremos.
const ENTRADAS = parsearNovedades(novedadesRaw);

/** Novedades de cada versión, leídas del changelog público del repo. */
export function NovedadesScreen() {
  useEffect(marcarNovedadesVistas, []);

  return (
    <section>
      <Topbar left={<span className={styles.rotulo}>Bayka · Novedades</span>} />
      <div className={styles.body}>
        <h1 className={styles.titulo}>Novedades</h1>
        <p className={styles.subtitulo}>Estás usando la versión {VERSION_APP}</p>
        {ENTRADAS.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Todavía no hay novedades publicadas"
            description="Cuando salga una versión nueva vas a ver acá qué cambió."
          />
        ) : (
          <div className={styles.entradas}>
            {ENTRADAS.map((entrada) => (
              <Card key={entrada.titulo} title={entrada.titulo}>
                <ul className={styles.items}>
                  {entrada.items.map((item) => (
                    <li key={`${item.titular ?? ''}${item.detalle}`} className={styles.item}>
                      {item.titular && <strong className={styles.titular}>{item.titular}</strong>}
                      {item.titular ? ` ${item.detalle}` : item.detalle}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
