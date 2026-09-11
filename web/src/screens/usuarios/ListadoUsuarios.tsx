import { useMemo, useState } from 'react';
import { CardTabla, LayoutConPanel, Table } from '../../components';
import { useAuth } from '../../hooks/useAuth';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { pluralizar } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { contarSuperadminsActivos, type AccionActiva } from './acciones';
import { columnasUsuarios } from './columnas';
import { UsuarioPanel } from './UsuarioPanel';

const PIE_AYUDA = 'clic en una fila abre el detalle en el panel lateral · ⋯ para acciones rápidas';
const PIE_NOTA = 'Las personas inactivas aparecen atenuadas';

interface ListadoUsuariosProps {
  /** Todas las personas: los guards cuentan los superadmins activos sin filtrar. */
  usuarios: UsuarioConAsignaciones[];
  visibles: UsuarioConAsignaciones[];
  onAccion: (activa: AccionActiva) => void;
}

/** Tabla de personas con el panel de detalle al costado. */
export function ListadoUsuarios({ usuarios, visibles, onAccion }: ListadoUsuariosProps) {
  const idActual = useAuth().perfil?.id;
  const [seleccionado, setSeleccionado] = useState<UsuarioConAsignaciones | null>(null);
  const superadminsActivos = useMemo(() => contarSuperadminsActivos(usuarios), [usuarios]);
  const columnas = useColumnasVisibles(
    useMemo(
      () => columnasUsuarios(onAccion, idActual, superadminsActivos),
      [onAccion, idActual, superadminsActivos],
    ),
  );
  const panel = seleccionado && (
    <UsuarioPanel
      // Remonta el panel al cambiar de fila: los campos se reinicializan con
      // los datos de la nueva persona.
      key={seleccionado.id}
      usuario={seleccionado}
      idActual={idActual}
      superadminsActivos={superadminsActivos}
      onAccion={(accion) => onAccion({ usuario: seleccionado, accion })}
      onCerrar={() => setSeleccionado(null)}
    />
  );
  return (
    <LayoutConPanel panel={panel}>
      <CardTabla
        pie={`${pluralizar(visibles.length, SUSTANTIVO.persona)} · ${PIE_AYUDA}`}
        pieDerecha={PIE_NOTA}
      >
        <Table
          columns={columnas}
          rows={visibles}
          getRowKey={(usuario) => usuario.id}
          claveSeleccionada={seleccionado?.id}
          onRowClick={setSeleccionado}
          emptyMessage="No hay usuarios con esos filtros"
        />
      </CardTabla>
    </LayoutConPanel>
  );
}
