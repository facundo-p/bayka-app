import { useQuery } from '@tanstack/react-query';
import { Cargando, MapaPuntos, Modal } from '../../components';
import { varsCss } from '../../lib/cssVars';
import { formatearFechaCorta } from '../../lib/fechas';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { obtenerUrlFoto, tieneFotoSubida } from '../../services/fotoService';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import styles from './ArbolDetalleModal.module.css';

interface ArbolDetalleModalProps {
  arbol: ArbolDetalle;
  parcelaCodigo: string | null;
  tecnicoNombre: string | null;
  onClose: () => void;
}

/** Especie del árbol: punto de color + "código · nombre" (N/N si sin identificar). */
function BloqueEspecie({ arbol }: { arbol: ArbolDetalle }) {
  const codigo = arbol.especieCodigo ?? 'N/N';
  const nombre = arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR;
  return (
    <div className={styles.bloque}>
      <span className={styles.etiqueta}>Especie</span>
      <span className={styles.especie}>
        <span
          className={styles.puntoEspecie}
          style={varsCss({ color: colorEspeciePorCodigo(arbol.especieCodigo) })}
        />
        {`${codigo} · ${nombre}`}
      </span>
    </div>
  );
}

/** Imagen de la foto firmada; tenue mientras carga o si no se pudo obtener. */
function FotoSubida({ fotoUrl, alt }: { fotoUrl: string; alt: string }) {
  const foto = useQuery({ queryKey: ['foto', fotoUrl], queryFn: () => obtenerUrlFoto(fotoUrl) });
  if (foto.isPending) return <Cargando />;
  if (!foto.data) return <span className={styles.tenue}>No se pudo cargar la foto</span>;
  return <img className={styles.foto} src={foto.data} alt={alt} />;
}

/** Foto del árbol: imagen firmada si está subida, si no un texto tenue. */
function BloqueFoto({ arbol }: { arbol: ArbolDetalle }) {
  return (
    <div className={styles.bloque}>
      <span className={styles.etiqueta}>Foto</span>
      {tieneFotoSubida(arbol.fotoUrl) ? (
        <FotoSubida fotoUrl={arbol.fotoUrl} alt={`Foto del árbol ${arbol.subId}`} />
      ) : (
        <span className={styles.tenue}>Sin foto</span>
      )}
    </div>
  );
}

/** Mapa con el único punto del árbol + sus coordenadas; tenue si no hay GPS. */
function BloqueGps({ arbol }: { arbol: ArbolDetalle }) {
  if (arbol.latitude == null || arbol.longitude == null) {
    return (
      <div className={styles.bloque}>
        <span className={styles.etiqueta}>GPS</span>
        <span className={styles.tenue}>Sin coordenada GPS</span>
      </div>
    );
  }
  const codigo = arbol.especieCodigo ?? ESPECIE_SIN_IDENTIFICAR;
  const punto = {
    lat: arbol.latitude,
    lng: arbol.longitude,
    codigo,
    nombre: arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR,
  };
  return (
    <div className={styles.bloque}>
      <span className={styles.etiqueta}>GPS</span>
      <MapaPuntos
        variante="compacto"
        puntos={[punto]}
        colorPorCodigo={new Map([[codigo, colorEspeciePorCodigo(arbol.especieCodigo)]])}
      />
      <span className={styles.coordenadas}>
        {arbol.latitude.toFixed(5)}, {arbol.longitude.toFixed(5)}
        {arbol.gpsAccuracy != null && (
          <span className={styles.precision}> ±{Math.round(arbol.gpsAccuracy)}m</span>
        )}
      </span>
    </div>
  );
}

/** Un dato del bloque de metadatos: etiqueta tenue + valor. */
function MetaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className={styles.metaDato}>
      <span className={styles.etiqueta}>{etiqueta}</span>
      <span className={styles.metaValor}>{valor}</span>
    </div>
  );
}

/** Grilla de metadatos del árbol (parcela, grupo, posición, fecha, técnico). */
function BloqueMeta({
  arbol,
  parcelaCodigo,
  tecnicoNombre,
}: {
  arbol: ArbolDetalle;
  parcelaCodigo: string | null;
  tecnicoNombre: string | null;
}) {
  return (
    <dl className={styles.meta}>
      <MetaDato etiqueta="Parcela" valor={parcelaCodigo ?? '—'} />
      <MetaDato etiqueta="Grupo" valor={arbol.grupoCodigo} />
      <MetaDato etiqueta="Posición" valor={arbol.posicion != null ? String(arbol.posicion) : '—'} />
      <MetaDato etiqueta="Registrado" valor={formatearFechaCorta(arbol.createdAt)} />
      <MetaDato etiqueta="Técnico" valor={tecnicoNombre ?? '—'} />
    </dl>
  );
}

/** Detalle de un árbol en modal: especie, foto, GPS y metadatos. */
export function ArbolDetalleModal({
  arbol,
  parcelaCodigo,
  tecnicoNombre,
  onClose,
}: ArbolDetalleModalProps) {
  return (
    <Modal open title={arbol.subId} onClose={onClose}>
      <div className={styles.cuerpo}>
        <BloqueEspecie arbol={arbol} />
        <BloqueFoto arbol={arbol} />
        <BloqueGps arbol={arbol} />
        <BloqueMeta arbol={arbol} parcelaCodigo={parcelaCodigo} tecnicoNombre={tecnicoNombre} />
      </div>
    </Modal>
  );
}
