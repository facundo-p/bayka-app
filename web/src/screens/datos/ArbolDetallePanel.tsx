import { useQuery } from '@tanstack/react-query';
import { Cargando, MapaPuntos, PanelBloque, PanelLateral } from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { ESPECIE_SIN_IDENTIFICAR, NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { obtenerUrlFoto, tieneFotoSubida } from '../../services/fotoService';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { SIN_DATO, tieneGps, type ArbolConGps } from './arbolFormato';
import { Coordenadas, EspecieConPunto } from './celdas';
import styles from './ArbolDetallePanel.module.css';

interface ArbolDetallePanelProps {
  arbol: ArbolDetalle;
  parcelaCodigo: string | null;
  tecnicoNombre: string | null;
  onCerrar: () => void;
}

function BloqueEspecie({ arbol }: { arbol: ArbolDetalle }) {
  return (
    <PanelBloque titulo="Especie">
      <EspecieConPunto arbol={arbol} tamano="lg" className={styles.especie} />
    </PanelBloque>
  );
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

function BloqueFoto({ arbol }: { arbol: ArbolDetalle }) {
  return (
    <PanelBloque titulo="Foto">
      {tieneFotoSubida(arbol.fotoUrl) ? (
        <FotoSubida fotoUrl={arbol.fotoUrl} alt={`Foto del árbol ${arbol.subId}`} />
      ) : (
        <span className={styles.tenue}>Sin foto</span>
      )}
    </PanelBloque>
  );
}

/** El único punto del árbol, con el color de su especie. */
function MapaDelArbol({ arbol }: { arbol: ArbolConGps }) {
  const codigo = arbol.especieCodigo ?? ESPECIE_SIN_IDENTIFICAR;
  const punto = {
    lat: arbol.latitude,
    lng: arbol.longitude,
    codigo,
    nombre: arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR,
    parcelaId: arbol.parcelaId,
  };
  const colorPorCodigo = new Map([[codigo, colorEspeciePorCodigo(arbol.especieCodigo)]]);
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

type BloqueMetaProps = Omit<ArbolDetallePanelProps, 'onCerrar'>;

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

/** Detalle de solo lectura de un árbol, al costado del listado: sin pie de acciones. */
export function ArbolDetallePanel({ onCerrar, ...datos }: ArbolDetallePanelProps) {
  const { arbol } = datos;
  return (
    <PanelLateral
      etiqueta={`Detalle del árbol ${arbol.subId}`}
      cabecera={<h2 className={styles.titulo}>{arbol.subId}</h2>}
      onCerrar={onCerrar}
    >
      <BloqueEspecie arbol={arbol} />
      <BloqueFoto arbol={arbol} />
      <BloqueGps arbol={arbol} />
      <BloqueMeta {...datos} />
    </PanelLateral>
  );
}
