import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PantallaListado, type TextosConsulta } from '../components';
import { useFiltrosListado } from '../hooks/useFiltrosListado';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarUsuariosConAsignaciones } from '../queries/usuarioQueries';
import type { AccionActiva } from './usuarios/acciones';
import { AgregarUsuarioModal } from './usuarios/AgregarUsuarioModal';
import { calcularMeta, filtrarUsuarios, FILTROS_INICIALES_USUARIOS } from './usuarios/filtros';
import { ListadoUsuarios } from './usuarios/ListadoUsuarios';
import { ModalDeAccion } from './usuarios/ModalDeAccion';
import { UsuariosToolbar } from './usuarios/UsuariosToolbar';

const TEXTOS: TextosConsulta = {
  error: 'No se pudieron cargar los usuarios.',
  vacio: {
    titulo: 'Sin usuarios',
    descripcion: 'Las personas de tu organización van a aparecer acá.',
  },
};

/** Todas las personas y las que pasan los filtros de la barra. */
function useUsuariosFiltrados() {
  const consulta = useQuery({
    queryKey: CLAVE_QUERY.usuarios(),
    queryFn: listarUsuariosConAsignaciones,
  });
  const { controles, visibles } = useFiltrosListado(
    consulta.data,
    filtrarUsuarios,
    FILTROS_INICIALES_USUARIOS,
  );
  return { consulta, usuarios: consulta.data ?? [], controles, visibles };
}

/** El modal abierto: el de una acción rápida o el alta. */
function useModalesUsuarios() {
  const [accionActiva, setAccionActiva] = useState<AccionActiva | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  return {
    accionActiva,
    agregarAbierto,
    abrirAccion: setAccionActiva,
    cerrarAccion: () => setAccionActiva(null),
    abrirAgregar: () => setAgregarAbierto(true),
    cerrarAgregar: () => setAgregarAbierto(false),
  };
}

function ModalesUsuarios({ modales }: { modales: ReturnType<typeof useModalesUsuarios> }) {
  return (
    <>
      {modales.accionActiva && (
        <ModalDeAccion {...modales.accionActiva} onClose={modales.cerrarAccion} />
      )}
      {modales.agregarAbierto && <AgregarUsuarioModal onClose={modales.cerrarAgregar} />}
    </>
  );
}

export function UsuariosScreen() {
  const { consulta, usuarios, controles, visibles } = useUsuariosFiltrados();
  const modales = useModalesUsuarios();
  return (
    <PantallaListado
      titulo="Usuarios"
      meta={consulta.data && calcularMeta(consulta.data)}
      accion={{ etiqueta: 'Agregar usuario', alActivar: modales.abrirAgregar }}
      barra={<UsuariosToolbar controles={controles} visibles={visibles} />}
      consulta={consulta}
      textos={TEXTOS}
      modales={<ModalesUsuarios modales={modales} />}
    >
      <ListadoUsuarios usuarios={usuarios} visibles={visibles} onAccion={modales.abrirAccion} />
    </PantallaListado>
  );
}
