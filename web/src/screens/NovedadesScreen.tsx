import { useEffect } from 'react';
import { Card, EmptyState, Topbar } from '../components';
import { VERSION_APP } from '../lib/entorno';
import { ENTRADAS } from '../lib/novedades';
import { esEntradaEnPruebas, type EntradaNovedades, type ItemNovedad } from '../lib/parsearNovedades';
import { marcarNovedadesVistas } from '../hooks/useNovedadesNoVistas';
import styles from './NovedadesScreen.module.css';

function PasosDePrueba({ pasos }: { pasos: string[] }) {
  return (
    <details className={styles.pasos}>
      <summary className={styles.pasosResumen}>Cómo probarlo</summary>
      <ol className={styles.pasosLista}>
        {pasos.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
    </details>
  );
}

function ListaItems({ items }: { items: ItemNovedad[] }) {
  return (
    <ul className={styles.items}>
      {items.map((item) => (
        <li key={`${item.titular ?? ''}${item.detalle}`} className={styles.item}>
          {item.titular && <strong className={styles.titular}>{item.titular}</strong>}
          {item.titular ? ` ${item.detalle}` : item.detalle}
          {item.pasos && <PasosDePrueba pasos={item.pasos} />}
        </li>
      ))}
    </ul>
  );
}

/** Lo que ya está en staging y todavía no pasó a producción. */
function CardEnPruebas({ entrada }: { entrada: EntradaNovedades }) {
  return (
    <Card className={styles.enPruebas}>
      <div className={styles.cabezaEnPruebas}>
        <h2 className={styles.tituloEnPruebas}>{entrada.titulo}</h2>
        <span className={styles.rotulo}>Todavía no está en producción</span>
      </div>
      <p className={styles.notaEnPruebas}>
        Esto ya se puede usar acá y va a llegar a producción cuando se apruebe. Si algo no se
        comporta como dice, avisanos antes del pase.
      </p>
      <ListaItems items={entrada.items} />
    </Card>
  );
}

function EntradaVista({ entrada }: { entrada: EntradaNovedades }) {
  if (esEntradaEnPruebas(entrada)) return <CardEnPruebas entrada={entrada} />;
  return (
    <Card title={entrada.titulo}>
      <ListaItems items={entrada.items} />
    </Card>
  );
}

/** Novedades de cada versión, leídas del changelog público del repo. */
export function NovedadesScreen() {
  useEffect(marcarNovedadesVistas, []);

  return (
    <section>
      <Topbar left={<span className={styles.rotuloTopbar}>Bayka · Novedades</span>} />
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
              <EntradaVista key={entrada.titulo} entrada={entrada} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
