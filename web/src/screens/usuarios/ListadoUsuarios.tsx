import { useMemo, useState } from 'react';
import { CardTabla, LayoutConPanel, Table, type TableColumn } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { contarSuperadminsActivos, type AccionActiva, type ContextoAcciones } from './acciones';
import { columnasUsuarios } from './columnas';
import { UsuarioPanel } from './UsuarioPanel';

const PIE_AYUDA = 'clic en una fila abre el detalle en el panel lateral · ⋯ para acciones rápidas';
const PIE_NOTA = 'Las personas inactivas aparecen atenuadas';

type AlElegirAccion = (activa: AccionActiva) => void;

interface ListadoUsuariosProps {
  /** Todas las personas: los guards cuentan los superadmins activos sin filtrar. */
  usuarios: UsuarioConAsignaciones[];
  visibles: UsuarioConAsignaciones[];
  onAccion: AlElegirAccion;
}

/** Las columnas visibles y el contexto de los guards, que comparte el panel. */
function useColumnasUsuarios(usuarios: UsuarioConAsignaciones[], onAccion: AlElegirAccion) {
  const idActual = useAuth().perfil?.id;
  const superadminsActivos = useMemo(() => contarSuperadminsActivos(usuarios), [usuarios]);
  const contexto: ContextoAcciones = useMemo(
    () => ({ idActual, superadminsActivos }),
    [idActual, superadminsActivos],
  );
  const columnas = useColumnasVisibles(
    useMemo(() => columnasUsuarios(onAccion, contexto), [onAccion, contexto]),
  );
  return { columnas, contexto };
}

/** La persona abierta en el panel; null con el panel cerrado. */
function useSeleccion() {
  const [seleccionado, setSeleccionado] = useState<UsuarioConAsignaciones | null>(null);
  return { seleccionado, seleccionar: setSeleccionado, cerrar: () => setSeleccionado(null) };
}

interface TablaUsuariosProps {
  visibles: UsuarioConAsignaciones[];
  columnas: Array<TableColumn<UsuarioConAsignaciones>>;
  seleccion: ReturnType<typeof useSeleccion>;
}

function TablaUsuarios({ visibles, columnas, seleccion }: TablaUsuariosProps) {
  return (
    <CardTabla
      pie={`${pluralizar(visibles.length, SUSTANTIVO.persona)} · ${PIE_AYUDA}`}
      pieDerecha={PIE_NOTA}
    >
      <Table
        columns={columnas}
        rows={visibles}
        getRowKey={(usuario) => usuario.id}
        claveSeleccionada={seleccion.seleccionado?.id}
        onRowClick={seleccion.seleccionar}
        emptyMessage="No hay usuarios con esos filtros"
      />
    </CardTabla>
  );
}

interface PanelDeFilaProps {
  usuario: UsuarioConAsignaciones;
  contexto: ContextoAcciones;
  onAccion: AlElegirAccion;
  onCerrar: () => void;
}

function PanelDeFila({ usuario, contexto, onAccion, onCerrar }: PanelDeFilaProps) {
  return (
    <UsuarioPanel
      // Remonta el panel al cambiar de fila: los campos se reinicializan con
      // los datos de la nueva persona.
      key={usuario.id}
      usuario={usuario}
      {...contexto}
      onAccion={(accion) => onAccion({ usuario, accion })}
      onCerrar={onCerrar}
    />
  );
}

/** Tabla de personas con el panel de detalle al costado. */
export function ListadoUsuarios({ usuarios, visibles, onAccion }: ListadoUsuariosProps) {
  const seleccion = useSeleccion();
  const { columnas, contexto } = useColumnasUsuarios(usuarios, onAccion);
  const panel = seleccion.seleccionado && (
    <PanelDeFila
      usuario={seleccion.seleccionado}
      contexto={contexto}
      onAccion={onAccion}
      onCerrar={seleccion.cerrar}
    />
  );
  return (
    <LayoutConPanel panel={panel}>
      <TablaUsuarios visibles={visibles} columnas={columnas} seleccion={seleccion} />
    </LayoutConPanel>
  );
}
