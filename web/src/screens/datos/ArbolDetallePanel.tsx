import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button, Cargando, MapaPuntos, PanelBloque, PanelLateral } from '../../components';
import { useColoresEspecie } from '../../hooks/useColoresEspecie';
import { useDescarga } from '../../hooks/useDescarga';
import { formatearFechaCorta } from '../../lib/fechas';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { descargarDesdeUrl } from '../../services/descargas';
import {
  obtenerUrlDescargaFoto,
  obtenerUrlFoto,
  tieneFotoSubida,
} from '../../services/fotoService';
import { TAMANO_ICONO } from '../../theme/iconos';
import { SIN_DATO, tieneGps, type ArbolConGps } from './arbolFormato';
import { BloqueEspecie } from './BloqueEspecie';
import { BotonFichaPdf } from './BotonFichaPdf';
import { Coordenadas } from './celdas';
import type { EdicionDeEspecie } from './useCambioDeEspecie';
import styles from './ArbolDetallePanel.module.css';

interface ArbolDetallePanelProps {
  arbol: ArbolDetalle;
  parcelaCodigo: string | null;
  tecnicoNombre: string | null;
  /** Nombre del archivo al descargar la foto; null mientras no cargó la plantación. */
  nombreFoto: string | null;
  /** Genera y descarga la ficha PDF; null mientras no cargó la plantación. */
  descargarFicha: (() => Promise<void>) | null;
  /** Sin esto la especie es de solo lectura. */
  edicionDeEspecie?: EdicionDeEspecie;
  onCerrar: () => void;
}

/** Tenue mientras carga o si no se pudo firmar la URL. */
function FotoSubida({ fotoUrl, alt }: { fotoUrl: string; alt: string }) {
  const foto = useQuery({
    queryKey: CLAVE_QUERY.foto(fotoUrl),
    queryFn: () => obtenerUrlFoto(fotoUrl),
  });
  if (foto.isPending) return <Cargando />;
  if (!foto.data) return <span className={styles.tenue}>No se pudo cargar la foto</span>;
  return <img className={styles.foto} src={foto.data} alt={alt} />;
}

const ERROR_DESCARGA_FOTO = 'No se pudo descargar la foto';

/** La URL firmada lleva el nombre: Storage la sirve como adjunto aunque sea de otro origen. */
function BotonDescargarFoto({
  fotoUrl,
  nombreFoto,
}: {
  fotoUrl: string;
  nombreFoto: string | null;
}) {
  const { descargar, descargando, mensaje } = useDescarga(async () => {
    if (!nombreFoto) return ERROR_DESCARGA_FOTO;
    const url = await obtenerUrlDescargaFoto(fotoUrl, nombreFoto);
    if (!url) return ERROR_DESCARGA_FOTO;
    descargarDesdeUrl(url, nombreFoto);
    return null;
  }, ERROR_DESCARGA_FOTO);
  return (
    <>
      <Button
        variant="contorno"
        size="sm"
        loading={descargando}
        disabled={!nombreFoto}
        onClick={descargar}
      >
        <Download size={TAMANO_ICONO.md} aria-hidden />
        Descargar
      </Button>
      {mensaje && <span className={styles.tenue}>{mensaje}</span>}
    </>
  );
}

function BloqueFoto({ arbol, nombreFoto }: { arbol: ArbolDetalle; nombreFoto: string | null }) {
  return (
    <PanelBloque titulo="Foto">
      {tieneFotoSubida(arbol.fotoUrl) ? (
        <>
          <FotoSubida fotoUrl={arbol.fotoUrl} alt={`Foto del árbol ${arbol.idArbol}`} />
          <BotonDescargarFoto fotoUrl={arbol.fotoUrl} nombreFoto={nombreFoto} />
        </>
      ) : (
        <span className={styles.tenue}>Sin foto</span>
      )}
    </PanelBloque>
  );
}

/** El único punto del árbol, con el color de su especie. */
function MapaDelArbol({ arbol }: { arbol: ArbolConGps }) {
  const colorDe = useColoresEspecie();
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

function BloqueGps({ arbol }: { arbol: ArbolDetalle }) {
  return (
    <PanelBloque titulo="GPS">
      {tieneGps(arbol) ? (
        <>
          <MapaDelArbol arbol={arbol} />
          <Coordenadas arbol={arbol} className={styles.coordenadas} />
        </>
      ) : (
        <span className={styles.tenue}>Sin coordenada GPS</span>
      )}
    </PanelBloque>
  );
}

function MetaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className={styles.metaDato}>
      <span className={styles.etiqueta}>{etiqueta}</span>
      <span className={styles.metaValor}>{valor}</span>
    </div>
  );
}

type BloqueMetaProps = Pick<ArbolDetallePanelProps, 'arbol' | 'parcelaCodigo' | 'tecnicoNombre'>;

function BloqueMeta({ arbol, parcelaCodigo, tecnicoNombre }: BloqueMetaProps) {
  return (
    <dl className={styles.meta}>
      <MetaDato etiqueta="Parcela" valor={parcelaCodigo ?? SIN_DATO} />
      <MetaDato etiqueta="Grupo" valor={arbol.grupoCodigo} />
      <MetaDato
        etiqueta="Posición"
        valor={arbol.posicion != null ? String(arbol.posicion) : SIN_DATO}
      />
      <MetaDato etiqueta="Registrado" valor={formatearFechaCorta(arbol.createdAt)} />
      <MetaDato etiqueta="Técnico" valor={tecnicoNombre ?? SIN_DATO} />
    </dl>
  );
}

/** Detalle de un árbol al costado del listado: solo se edita la especie (#679). */
export function ArbolDetallePanel({
  onCerrar,
  nombreFoto,
  descargarFicha,
  edicionDeEspecie,
  ...datos
}: ArbolDetallePanelProps) {
  const { arbol } = datos;
  return (
    <PanelLateral
      etiqueta={`Detalle del árbol ${arbol.idArbol}`}
      cabecera={<h2 className={styles.titulo}>{arbol.idArbol}</h2>}
      pie={<BotonFichaPdf descargar={descargarFicha} />}
      onCerrar={onCerrar}
    >
      <BloqueEspecie arbol={arbol} edicion={edicionDeEspecie} />
      <BloqueFoto arbol={arbol} nombreFoto={nombreFoto} />
      <BloqueGps arbol={arbol} />
      <BloqueMeta {...datos} />
    </PanelLateral>
  );
}
