import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CameraOff, Download, ExternalLink, MapPinOff, Smartphone, Trash2 } from 'lucide-react';
import {
  BotonCopiar,
  BotonIcono,
  Button,
  ConfirmarModal,
  MapaPuntos,
  Modal,
  Spinner,
} from '../../components';
import { useColorEspecie } from '../../hooks/useColoresEspecie';
import { useDescarga } from '../../hooks/useDescarga';
import { cx } from '../../lib/classNames';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { descargarDesdeUrl } from '../../services/descargas';
import {
  esFotoLocal,
  fotoSubida,
  obtenerUrlDescargaFoto,
  obtenerUrlFoto,
} from '../../services/fotoService';
import { TAMANO_ICONO } from '../../theme/iconos';
import {
  textoCoordenadas,
  textoPrecisionGps,
  tieneGps,
  urlGoogleMaps,
  type ArbolConGps,
} from './arbolFormato';
import { BloqueDetalle } from './BloqueDetalle';
import { descripcionEliminarFoto } from './eliminacionDeFoto';
import { useEliminarFoto, type EliminacionDeFoto, type EliminarFoto } from './useEliminarFoto';
import styles from './FotoYMapa.module.css';

export const TEXTO_FOTO_Y_MAPA = {
  titulo: 'Foto y GPS',
  sinFoto: 'Sin foto',
  sinSubir: 'Foto sin subir',
  sinSubirDetalle: 'Sigue en el celular que la sacó. Se ve acá cuando sincronice.',
  noCargo: 'No se pudo cargar la foto',
  ampliar: 'Ampliar foto',
  descargar: 'Descargar foto',
  descargarCorto: 'Descargar',
  errorDescarga: 'No se pudo descargar la foto',
  eliminar: 'Eliminar foto',
  avisoEliminar: 'No se puede deshacer.',
  sinGps: 'Sin punto GPS',
  googleMaps: 'Google Maps',
  pestanaNueva: ' (abre en una pestaña nueva)',
  copiarCoordenadas: 'Copiar coordenadas',
  cerrar: 'Cerrar',
} as const;

const T = TEXTO_FOTO_Y_MAPA;

/** Caja cuadrada vacía: el alto del panel no cambia entre árboles con y sin foto o GPS. */
function CuadroVacio({
  icono,
  titulo,
  pendiente = false,
  children,
}: {
  icono: ReactNode;
  titulo: ReactNode;
  pendiente?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cx(styles.cuadro, styles.vacio, pendiente && styles.pendiente)}>
      <span className={styles.iconoVacio}>{icono}</span>
      <span className={styles.tituloVacio}>{titulo}</span>
      {children}
    </div>
  );
}

function FotoSinSubir() {
  return (
    <CuadroVacio
      pendiente
      icono={<Smartphone size={TAMANO_ICONO.lg} aria-hidden />}
      titulo={
        <>
          <span className={styles.puntoPendiente} aria-hidden />
          {T.sinSubir}
        </>
      }
    >
      <span className={styles.detalleVacio}>{T.sinSubirDetalle}</span>
    </CuadroVacio>
  );
}

function SinFoto({ titulo = T.sinFoto }: { titulo?: string }) {
  return <CuadroVacio icono={<CameraOff size={TAMANO_ICONO.lg} aria-hidden />} titulo={titulo} />;
}

/** La URL firmada lleva el nombre: Storage la sirve como adjunto aunque sea de otro origen. */
function useDescargaFoto(fotoUrl: string, nombreFoto: string | null) {
  return useDescarga(async () => {
    if (!nombreFoto) return T.errorDescarga;
    const url = await obtenerUrlDescargaFoto(fotoUrl, nombreFoto);
    if (!url) return T.errorDescarga;
    descargarDesdeUrl(url, nombreFoto);
    return null;
  }, T.errorDescarga);
}

function BotonDescargarFoto({
  descarga,
  nombreFoto,
}: {
  descarga: ReturnType<typeof useDescargaFoto>;
  nombreFoto: string | null;
}) {
  return (
    <BotonIcono
      variante="contorno"
      tamano="sm"
      etiqueta={T.descargar}
      title={T.descargar}
      disabled={!nombreFoto || descarga.descargando}
      onClick={descarga.descargar}
    >
      {descarga.descargando ? (
        <Spinner size="sm" />
      ) : (
        <Download size={TAMANO_ICONO.md} aria-hidden />
      )}
    </BotonIcono>
  );
}

/** Deshabilitado, el tooltip dice por qué. */
function BotonEliminarFoto({ eliminar }: { eliminar: EliminarFoto }) {
  return (
    <BotonIcono
      variante="contorno"
      tamano="sm"
      destructiva
      etiqueta={T.eliminar}
      title={eliminar.motivoBloqueo ?? T.eliminar}
      disabled={eliminar.motivoBloqueo !== null}
      onClick={eliminar.pedir}
    >
      <Trash2 size={TAMANO_ICONO.md} aria-hidden />
    </BotonIcono>
  );
}

interface AccionesFotoProps {
  descarga: ReturnType<typeof useDescargaFoto>;
  nombreFoto: string | null;
  eliminar: EliminarFoto;
}

/** Eliminar a la izquierda, separado de descargar y cerrar. */
function AccionesFotoAmpliada({
  descarga,
  nombreFoto,
  eliminar,
  onCerrar,
}: AccionesFotoProps & { onCerrar: () => void }) {
  return (
    <div className={styles.accionesModal}>
      {eliminar.disponible && (
        <Button
          variant="destructiva"
          className={styles.accionApartada}
          title={eliminar.motivoBloqueo ?? undefined}
          disabled={eliminar.motivoBloqueo !== null}
          onClick={eliminar.pedir}
        >
          <Trash2 size={TAMANO_ICONO.md} aria-hidden />
          {T.eliminar}
        </Button>
      )}
      <Button
        variant="contorno"
        loading={descarga.descargando}
        disabled={!nombreFoto}
        onClick={descarga.descargar}
      >
        {!descarga.descargando && <Download size={TAMANO_ICONO.md} aria-hidden />}
        {T.descargarCorto}
      </Button>
      <Button variant="contorno" onClick={onCerrar}>
        {T.cerrar}
      </Button>
    </div>
  );
}

interface FotoAmpliadaProps extends AccionesFotoProps {
  src: string;
  alt: string;
  abierta: boolean;
  onCerrar: () => void;
}

/** La foto entera, sin recortar, lo más grande que entre. */
function FotoAmpliada({ src, alt, abierta, onCerrar, ...acciones }: FotoAmpliadaProps) {
  return (
    <Modal open={abierta} title={alt} onClose={onCerrar} ancho="amplio">
      <img className={styles.fotoAmpliada} src={src} alt={alt} />
      {acciones.descarga.mensaje && (
        <span className={styles.error}>{acciones.descarga.mensaje}</span>
      )}
      <AccionesFotoAmpliada {...acciones} onCerrar={onCerrar} />
    </Modal>
  );
}

interface FotoProps {
  fotoUrl: string;
  alt: string;
  nombreFoto: string | null;
  eliminar: EliminarFoto;
}

interface CuadroFotoProps {
  src: string;
  alt: string;
  onAmpliar: () => void;
  /** Acciones sobre la esquina de la foto. */
  children: ReactNode;
}

/** Recortada al cuadrado para mostrar; el click la abre entera. */
function CuadroFoto({ src, alt, onAmpliar, children }: CuadroFotoProps) {
  return (
    <div className={styles.cuadro}>
      <button
        type="button"
        className={styles.botonFoto}
        onClick={onAmpliar}
        aria-label={T.ampliar}
        title={T.ampliar}
      >
        <img className={styles.foto} src={src} alt={alt} />
      </button>
      <div className={styles.sobreFoto}>{children}</div>
    </div>
  );
}

function FotoCargada({ src, alt, fotoUrl, nombreFoto, eliminar }: FotoProps & { src: string }) {
  const [ampliada, setAmpliada] = useState(false);
  const descarga = useDescargaFoto(fotoUrl, nombreFoto);
  return (
    <>
      <CuadroFoto src={src} alt={alt} onAmpliar={() => setAmpliada(true)}>
        <BotonDescargarFoto descarga={descarga} nombreFoto={nombreFoto} />
        {eliminar.disponible && <BotonEliminarFoto eliminar={eliminar} />}
      </CuadroFoto>
      {descarga.mensaje && <span className={styles.error}>{descarga.mensaje}</span>}
      <FotoAmpliada
        src={src}
        alt={alt}
        abierta={ampliada}
        onCerrar={() => setAmpliada(false)}
        descarga={descarga}
        nombreFoto={nombreFoto}
        eliminar={eliminar}
      />
    </>
  );
}

function FotoSubida(props: FotoProps) {
  const foto = useQuery({
    queryKey: CLAVE_QUERY.foto(props.fotoUrl),
    queryFn: () => obtenerUrlFoto(props.fotoUrl),
  });
  if (foto.isPending) {
    return (
      <div className={cx(styles.cuadro, styles.vacio)}>
        <Spinner />
      </div>
    );
  }
  if (!foto.data) return <SinFoto titulo={T.noCargo} />;
  return <FotoCargada {...props} src={foto.data} />;
}

function ConfirmarEliminarFoto({ idArbol, eliminar }: { idArbol: string; eliminar: EliminarFoto }) {
  if (!eliminar.confirmando) return null;
  return (
    <ConfirmarModal
      titulo={T.eliminar}
      descripcion={descripcionEliminarFoto(idArbol)}
      aviso={T.avisoEliminar}
      confirmarEtiqueta={T.eliminar}
      destructiva
      accion={eliminar.eliminar}
      alCompletar={eliminar.alCompletar}
      onClose={eliminar.cerrar}
    />
  );
}

interface CeldaFotoProps {
  arbol: ArbolDetalle;
  nombreFoto: string | null;
  eliminar: EliminarFoto;
}

/** Subida, sin subir (sigue en el celular) o sin foto. */
function ContenidoFoto({ arbol, nombreFoto, eliminar }: CeldaFotoProps) {
  const subida = fotoSubida(arbol.fotoUrl);
  if (subida) {
    return (
      <FotoSubida
        fotoUrl={subida}
        alt={`Foto del árbol ${arbol.idArbol}`}
        nombreFoto={nombreFoto}
        eliminar={eliminar}
      />
    );
  }
  if (esFotoLocal(arbol.fotoUrl)) return <FotoSinSubir />;
  return <SinFoto />;
}

/** La confirmación vive acá: sigue montada aunque la foto cambie o desaparezca. */
function CeldaFoto({
  arbol,
  nombreFoto,
  eliminacion,
}: Omit<CeldaFotoProps, 'eliminar'> & {
  eliminacion?: EliminacionDeFoto;
}) {
  const eliminar = useEliminarFoto(arbol, eliminacion);
  return (
    <div className={styles.celda}>
      <ContenidoFoto arbol={arbol} nombreFoto={nombreFoto} eliminar={eliminar} />
      {eliminar.aviso && (
        <span className={styles.aviso} role="status">
          {eliminar.aviso}
        </span>
      )}
      <ConfirmarEliminarFoto idArbol={arbol.idArbol} eliminar={eliminar} />
    </div>
  );
}

/** El único punto del árbol, con el color de su especie. */
function MapaDelArbol({ arbol }: { arbol: ArbolConGps }) {
  const colorDe = useColorEspecie();
  const codigo = arbol.especieCodigo ?? ESPECIE_SIN_IDENTIFICAR;
  const punto = {
    lat: arbol.latitude,
    lng: arbol.longitude,
    codigo,
    nombre: arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR,
    idArbol: arbol.idArbol,
    subId: arbol.subId,
    parcelaId: arbol.parcelaId,
  };
  const colorPorCodigo = new Map([[codigo, colorDe(arbol.especieCodigo)]]);
  return <MapaPuntos variante="compacto" puntos={[punto]} colorPorCodigo={colorPorCodigo} />;
}

function EnlaceGoogleMaps({ arbol }: { arbol: ArbolConGps }) {
  return (
    <a
      className={styles.enlace}
      href={urlGoogleMaps(arbol)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {T.googleMaps}
      <span className={styles.soloLectores}>{T.pestanaNueva}</span>
      <ExternalLink size={TAMANO_ICONO.sm} aria-hidden />
    </a>
  );
}

function FilaCoordenadas({ arbol }: { arbol: ArbolConGps }) {
  const coordenadas = textoCoordenadas(arbol);
  const precision = textoPrecisionGps(arbol);
  return (
    <div className={styles.coordenadas}>
      <span>{coordenadas}</span>
      {precision && <span className={styles.precision}>{precision}</span>}
      <BotonCopiar texto={coordenadas} etiqueta={T.copiarCoordenadas} />
    </div>
  );
}

/** Foto y mapa en dos cuadrados lado a lado, como en la ficha PDF. */
export function FotoYMapa({
  arbol,
  nombreFoto,
  eliminacion,
}: {
  arbol: ArbolDetalle;
  nombreFoto: string | null;
  /** Sin esto no se ofrece eliminar la foto. */
  eliminacion?: EliminacionDeFoto;
}) {
  const conGps = tieneGps(arbol);
  return (
    <BloqueDetalle titulo={T.titulo} accion={conGps && <EnlaceGoogleMaps arbol={arbol} />}>
      <div className={styles.dos}>
        <CeldaFoto arbol={arbol} nombreFoto={nombreFoto} eliminacion={eliminacion} />
        {conGps ? (
          <MapaDelArbol arbol={arbol} />
        ) : (
          <CuadroVacio icono={<MapPinOff size={TAMANO_ICONO.lg} aria-hidden />} titulo={T.sinGps} />
        )}
      </div>
      {conGps && <FilaCoordenadas arbol={arbol} />}
    </BloqueDetalle>
  );
}
