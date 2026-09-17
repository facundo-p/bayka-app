import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { ChevronDown, Download, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import {
  Aviso,
  Badge,
  BotonIcono,
  Button,
  CabeceraSeccion,
  Cargando,
  Divisor,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  MenuDesplegable,
  PlantacionFormModal,
  TabNav,
  Topbar,
  type ItemDesplegable,
  type TabItem,
} from '../components';
import { useIdPlantacion } from '../hooks/useIdPlantacion';
import { usePlantacion } from '../hooks/usePlantacion';
import { formatearFechaCorta } from '../lib/fechas';
import { RUTA, rutaPlantacion, TAB_DETALLE } from '../lib/rutas';
import { esArchivada, type Plantacion } from '../queries/plantationQueries';
import { ArchivadoModal } from './plantaciones/ArchivadoModal';
import { EliminarPlantacionModal } from './plantaciones/EliminarPlantacionModal';
import { GenerarIdsModal } from './plantaciones/GenerarIdsModal';
import {
  MODAL_ADMINISTRACION,
  useAccionesDetalle,
  type AccionesProps,
} from './useAccionesDetalle';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './PlantacionDetailScreen.module.css';

/** La planilla se arma con los IDs definitivos: sin generarlos no hay qué exportar. */
const MOTIVO_IDS_PENDIENTES = 'Generá los IDs de la plantación para exportar la planilla';

const AVISO_ARCHIVADA =
  'Plantación archivada: no aparece en los listados ni en la app, y queda en solo lectura. ' +
  'Los celulares con datos sin subir los van a poder subir cuando se desarchive.';

function tabsDePlantacion(id: string): TabItem[] {
  return [
    { to: rutaPlantacion(id), label: 'Dashboard', end: true },
    { to: rutaPlantacion(id, TAB_DETALLE.datos), label: 'Datos' },
    { to: rutaPlantacion(id, TAB_DETALLE.configuracion), label: 'Configuración' },
  ];
}

function VolverAlListado() {
  return (
    <Link to={RUTA.plantaciones} className={styles.volver}>
      ← Volver a plantaciones
    </Link>
  );
}

function PlantacionNoEncontrada() {
  return (
    <EmptyState
      title="Plantación no encontrada"
      description="El enlace puede estar vencido o la plantación fue eliminada."
    >
      <VolverAlListado />
    </EmptyState>
  );
}

/** Línea de metadatos: período · fecha de creación. */
function lineaMeta(plantacion: Plantacion): string {
  return `${plantacion.periodo} · Creada ${formatearFechaCorta(plantacion.createdAt)}`;
}

function itemsExportar({ kml, xlsx, csv, idsPendientes }: AccionesProps): ItemDesplegable[] {
  const motivoPlanilla = idsPendientes ? MOTIVO_IDS_PENDIENTES : null;
  return [
    { clave: 'kml', etiqueta: 'Descargar KML', onSeleccionar: () => void kml.descargar() },
    {
      clave: 'xlsx',
      etiqueta: 'Exportar Excel',
      motivo: motivoPlanilla,
      onSeleccionar: () => void xlsx.descargar(),
    },
    {
      clave: 'csv',
      etiqueta: 'Exportar CSV',
      motivo: motivoPlanilla,
      onSeleccionar: () => void csv.descargar(),
    },
  ];
}

function MenuExportar(props: AccionesProps) {
  const descargando = props.kml.descargando || props.xlsx.descargando || props.csv.descargando;
  return (
    <MenuDesplegable
      etiqueta="Exportar"
      items={itemsExportar(props)}
      disparador={(propsDisparador) => (
        <Button variant="secondary" size="sm" loading={descargando} {...propsDisparador}>
          <Download size={TAMANO_ICONO.md} aria-hidden />
          Exportar
          <ChevronDown size={TAMANO_ICONO.sm} aria-hidden />
        </Button>
      )}
    />
  );
}

function BotonEditar({ onEditar, motivo }: { onEditar: () => void; motivo: string | null }) {
  return (
    <BotonIcono
      variante="contornoTransparente"
      tamano="sm"
      etiqueta="Editar"
      title={motivo ?? 'Editar'}
      disabled={Boolean(motivo)}
      onClick={onEditar}
    >
      <Pencil size={TAMANO_ICONO.md} aria-hidden />
    </BotonIcono>
  );
}

function itemsAdministracion({ administracion }: AccionesProps): ItemDesplegable[] {
  return administracion.map(({ onElegir, ...item }) => ({ ...item, onSeleccionar: onElegir }));
}

interface MenuMasAccionesProps {
  etiqueta: string;
  items: ItemDesplegable[];
  tamano: 'sm' | 'md';
}

/** El «⋯»: en la barra angosta lleva todas las acciones; en la ancha, las secundarias. */
function MenuMasAcciones({ etiqueta, items, tamano }: MenuMasAccionesProps) {
  return (
    <MenuDesplegable
      etiqueta={etiqueta}
      items={items}
      disparador={({ 'aria-label': nombre, ...propsDisparador }) => (
        <BotonIcono
          variante="contornoTransparente"
          tamano={tamano}
          etiqueta={nombre}
          {...propsDisparador}
        >
          <MoreHorizontal size={TAMANO_ICONO.lg} aria-hidden />
        </BotonIcono>
      )}
    />
  );
}

function AccionesDesplegadas(props: AccionesProps) {
  const secundarias = itemsAdministracion(props);
  return (
    <>
      <BotonEditar onEditar={props.onEditar} motivo={props.motivoEdicion} />
      <MenuExportar {...props} />
      {props.idsPendientes && (
        <Button
          variant="primary"
          size="sm"
          onClick={props.onGenerarIds}
          disabled={Boolean(props.motivoEdicion)}
          title={props.motivoEdicion ?? undefined}
        >
          <Plus size={TAMANO_ICONO.md} aria-hidden />
          Generar IDs
        </Button>
      )}
      {secundarias.length > 0 && (
        <MenuMasAcciones etiqueta="Más acciones" items={secundarias} tamano="sm" />
      )}
    </>
  );
}

function itemsPlegados(props: AccionesProps): ItemDesplegable[] {
  const { motivoEdicion: motivo, onEditar, onGenerarIds } = props;
  const items: ItemDesplegable[] = [
    { clave: 'editar', etiqueta: 'Editar plantación', motivo, onSeleccionar: onEditar },
    ...itemsExportar(props),
  ];
  if (props.idsPendientes) {
    items.push({ clave: 'ids', etiqueta: 'Generar IDs', motivo, onSeleccionar: onGenerarIds });
  }
  return [...items, ...itemsAdministracion(props)];
}

/** Barra angosta: las mismas acciones en un solo «⋯». Desplegadas se comen
 *  tres renglones de barra y empujan el contenido fuera del primer pantallazo.
 *  Como el «⋯» es el único acceso a esas acciones, va con el destino táctil
 *  completo. */
function AccionesPlegadas(props: AccionesProps) {
  return (
    <MenuMasAcciones etiqueta="Acciones de la plantación" items={itemsPlegados(props)} tamano="md" />
  );
}

interface ModalAdministracionDetalleProps {
  plantacion: Plantacion;
  detalle: ReturnType<typeof useAccionesDetalle>;
}

function ModalAdministracionDetalle({ plantacion, detalle }: ModalAdministracionDetalleProps) {
  if (detalle.modalAdministracion === MODAL_ADMINISTRACION.archivado) {
    return <ArchivadoModal plantacion={plantacion} onClose={detalle.cerrarModal} />;
  }
  if (detalle.modalAdministracion === MODAL_ADMINISTRACION.eliminacion) {
    return (
      <EliminarPlantacionModal
        plantacion={plantacion}
        onClose={detalle.cerrarModal}
        onArchivar={detalle.abrirArchivado}
      />
    );
  }
  return null;
}

interface AccionesDetalleProps {
  plantacion: Plantacion;
  onEditar: () => void;
}

/** Lado derecho de la barra. El mensaje de las descargas cuelga debajo del
 *  botón para no ensanchar la barra. */
function AccionesDetalle({ plantacion, onEditar }: AccionesDetalleProps) {
  const detalle = useAccionesDetalle(plantacion, onEditar);
  const Acciones = detalle.plegado ? AccionesPlegadas : AccionesDesplegadas;
  return (
    <div className={styles.acciones}>
      <TabNav label="Secciones de la plantación" tabs={tabsDePlantacion(plantacion.id)} />
      <Divisor />
      <Acciones {...detalle.acciones} />
      {detalle.mensaje && (
        <span className={styles.mensajeAccion} role="alert">
          {detalle.mensaje}
        </span>
      )}
      {detalle.generandoIds && (
        <GenerarIdsModal plantationId={plantacion.id} onClose={detalle.cerrarGenerarIds} />
      )}
      <ModalAdministracionDetalle plantacion={plantacion} detalle={detalle} />
    </div>
  );
}

/** Lado izquierdo de la barra: el breadcrumb ES el título de la pantalla. */
function CabeceraPlantacion({ plantacion }: { plantacion: Plantacion }) {
  return (
    <CabeceraSeccion
      raiz="Plantaciones"
      raizA={RUTA.plantaciones}
      titulo={plantacion.lugar}
      meta={lineaMeta(plantacion)}
    >
      <EstadoPlantacionBadge estado={plantacion.estado} />
      {esArchivada(plantacion) && <Badge variant="aviso">Archivada</Badge>}
    </CabeceraSeccion>
  );
}

/** Una sola barra con título, tabs y acciones; cada tab se renderiza en el
 *  Outlet y llena el alto restante. */
function DetallePlantacion({ plantacion }: { plantacion: Plantacion }) {
  const [editando, setEditando] = useState(false);
  return (
    <section>
      <Topbar
        densidad="compacta"
        left={<CabeceraPlantacion plantacion={plantacion} />}
        right={<AccionesDetalle plantacion={plantacion} onEditar={() => setEditando(true)} />}
      />
      <div className={styles.contenido}>
        {esArchivada(plantacion) && (
          <div className={styles.avisoArchivada}>
            <Aviso>{AVISO_ARCHIVADA}</Aviso>
          </div>
        )}
        <Outlet />
      </div>
      {editando && (
        <PlantacionFormModal plantacion={plantacion} onClose={() => setEditando(false)} />
      )}
    </section>
  );
}

export function PlantacionDetailScreen() {
  const id = useIdPlantacion();
  const { data, isPending, isError, refetch } = usePlantacion(id);
  if (isPending) return <Cargando />;
  if (isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudo cargar la plantación."
        onReintentar={() => void refetch()}
      />
    );
  }
  if (!data) return <PlantacionNoEncontrada />;
  return <DetallePlantacion plantacion={data} />;
}
