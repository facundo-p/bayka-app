import { BotonCopiar, PanelLateral } from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import type { CodigoNombre } from '../../queries/fichasQueries';
import { SIN_DATO } from './arbolFormato';
import { BloqueEspecie } from './BloqueEspecie';
import { BotonFichaPdf } from './BotonFichaPdf';
import { FotoYMapa } from './FotoYMapa';
import type { EdicionDeEspecie } from './useCambioDeEspecie';
import styles from './ArbolDetallePanel.module.css';

interface ArbolDetallePanelProps {
  arbol: ArbolDetalle;
  /** null si el árbol no tiene parcela o todavía no cargaron. */
  parcela: CodigoNombre | null;
  tecnicoNombre: string | null;
  /** Nombre del archivo al descargar la foto; null mientras no cargó la plantación. */
  nombreFoto: string | null;
  /** Genera y descarga la ficha PDF; null mientras no cargó la plantación. */
  descargarFicha: (() => Promise<void>) | null;
  /** Sin esto la especie es de solo lectura. */
  edicionDeEspecie?: EdicionDeEspecie;
  onCerrar: () => void;
}

function CabeceraArbol({ idArbol }: { idArbol: string }) {
  return (
    <div className={styles.identidad}>
      <h2 className={styles.titulo}>{idArbol}</h2>
      <BotonCopiar texto={idArbol} etiqueta="Copiar ID Árbol" />
    </div>
  );
}

interface CeldaUbicacionProps {
  etiqueta: string;
  codigo: string | null;
  nombre?: string | null;
}

function CeldaUbicacion({ etiqueta, codigo, nombre }: CeldaUbicacionProps) {
  return (
    <div className={styles.celdaUbicacion}>
      <dt className={styles.rotulo}>{etiqueta}</dt>
      <dd className={styles.codigoUbicacion}>{codigo ?? SIN_DATO}</dd>
      {nombre && (
        <dd className={styles.nombreUbicacion} title={nombre}>
          {nombre}
        </dd>
      )}
    </div>
  );
}

function UbicacionArbol({ arbol, parcela }: Pick<ArbolDetallePanelProps, 'arbol' | 'parcela'>) {
  return (
    <dl className={styles.ubicacion}>
      <CeldaUbicacion
        etiqueta="Parcela"
        codigo={parcela?.codigo ?? null}
        nombre={parcela?.nombre}
      />
      <CeldaUbicacion etiqueta="Grupo" codigo={arbol.grupoCodigo} nombre={arbol.grupoNombre} />
      <CeldaUbicacion
        etiqueta="Posición"
        codigo={arbol.posicion != null ? String(arbol.posicion) : null}
      />
    </dl>
  );
}

function RegistroArbol({ createdAt, tecnico }: { createdAt: string; tecnico: string | null }) {
  return (
    <p className={styles.registro}>
      Registrado el <strong>{formatearFechaCorta(createdAt)}</strong> por{' '}
      <strong>{tecnico ?? SIN_DATO}</strong>
    </p>
  );
}

/** Detalle de un árbol al costado del listado: solo se edita la especie (#679). */
export function ArbolDetallePanel({
  arbol,
  parcela,
  tecnicoNombre,
  nombreFoto,
  descargarFicha,
  edicionDeEspecie,
  onCerrar,
}: ArbolDetallePanelProps) {
  return (
    <PanelLateral
      etiqueta={`Detalle del árbol ${arbol.idArbol}`}
      cabecera={<CabeceraArbol idArbol={arbol.idArbol} />}
      pie={<BotonFichaPdf descargar={descargarFicha} />}
      onCerrar={onCerrar}
    >
      <BloqueEspecie arbol={arbol} edicion={edicionDeEspecie} />
      <UbicacionArbol arbol={arbol} parcela={parcela} />
      <FotoYMapa arbol={arbol} nombreFoto={nombreFoto} />
      <RegistroArbol createdAt={arbol.createdAt} tecnico={tecnicoNombre} />
    </PanelLateral>
  );
}
