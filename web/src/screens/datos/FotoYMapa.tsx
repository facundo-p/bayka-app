import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CameraOff, Download, ExternalLink, MapPinOff, Smartphone } from 'lucide-react';
import { BotonCopiar, BotonIcono, Button, MapaPuntos, Modal, Spinner } from '../../components';
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
import styles from './FotoYMapa.module.css';

export const TEXTO_FOTO_Y_MAPA = {
  titulo: 'Foto y GPS',
  sinFoto: 'Sin foto',
  sinSubir: 'Foto sin subir',
  sinSubirDetalle: 'Sigue en el celular que la sacó. Se ve acá cuando sincronice.',
  noCargo: 'No se pudo cargar la foto',
  ampliar: 'Ampliar foto',
  descargar: 'Descargar foto',
  errorDescarga: 'No se pudo descargar la foto',
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

interface FotoAmpliadaProps {
  src: string;
  alt: string;
  abierta: boolean;
  onCerrar: () => void;
}

/** La foto entera, sin recortar, lo más grande que entre. */
function FotoAmpliada({ src, alt, abierta, onCerrar }: FotoAmpliadaProps) {
  return (
    <Modal open={abierta} title={alt} onClose={onCerrar} ancho="amplio">
      <img className={styles.fotoAmpliada} src={src} alt={alt} />
      <div className={styles.accionesModal}>
        <Button variant="contorno" onClick={onCerrar}>
          {T.cerrar}
        </Button>
      </div>
    </Modal>
  );
}

interface FotoProps {
  fotoUrl: string;
  alt: string;
  nombreFoto: string | null;
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

function FotoCargada({ src, alt, fotoUrl, nombreFoto }: FotoProps & { src: string }) {
  const [ampliada, setAmpliada] = useState(false);
  const descarga = useDescargaFoto(fotoUrl, nombreFoto);
  return (
    <div className={styles.celda}>
      <CuadroFoto src={src} alt={alt} onAmpliar={() => setAmpliada(true)}>
        <BotonDescargarFoto descarga={descarga} nombreFoto={nombreFoto} />
      </CuadroFoto>
      {descarga.mensaje && <span className={styles.error}>{descarga.mensaje}</span>}
      <FotoAmpliada src={src} alt={alt} abierta={ampliada} onCerrar={() => setAmpliada(false)} />
    </div>
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

/** Subida, sin subir (sigue en el celular) o sin foto. */
function CeldaFoto({ arbol, nombreFoto }: { arbol: ArbolDetalle; nombreFoto: string | null }) {
  const subida = fotoSubida(arbol.fotoUrl);
  if (subida) {
    return (
      <FotoSubida
        fotoUrl={subida}
        alt={`Foto del árbol ${arbol.idArbol}`}
        nombreFoto={nombreFoto}
      />
    );
  }
  if (esFotoLocal(arbol.fotoUrl)) return <FotoSinSubir />;
  return <SinFoto />;
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
}: {
  arbol: ArbolDetalle;
  nombreFoto: string | null;
}) {
  const conGps = tieneGps(arbol);
  return (
    <BloqueDetalle titulo={T.titulo} accion={conGps && <EnlaceGoogleMaps arbol={arbol} />}>
      <div className={styles.dos}>
        <CeldaFoto arbol={arbol} nombreFoto={nombreFoto} />
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
