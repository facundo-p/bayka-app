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

export function UsuariosScreen() {
  const consulta = useQuery({
    queryKey: CLAVE_QUERY.usuarios(),
    queryFn: listarUsuariosConAsignaciones,
  });
  const { controles, visibles } = useFiltrosListado(
    consulta.data,
    filtrarUsuarios,
    FILTROS_INICIALES_USUARIOS,
  );
  const [accionActiva, setAccionActiva] = useState<AccionActiva | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const modales = (
    <>
      {accionActiva && <ModalDeAccion {...accionActiva} onClose={() => setAccionActiva(null)} />}
      {agregarAbierto && <AgregarUsuarioModal onClose={() => setAgregarAbierto(false)} />}
    </>
  );
  return (
    <PantallaListado
      titulo="Usuarios"
      meta={consulta.data && calcularMeta(consulta.data)}
      accion={{ etiqueta: 'Agregar usuario', alActivar: () => setAgregarAbierto(true) }}
      barra={<UsuariosToolbar controles={controles} visibles={visibles} />}
      consulta={consulta}
      textos={TEXTOS}
      modales={modales}
    >
      <ListadoUsuarios
        usuarios={consulta.data ?? []}
        visibles={visibles}
        onAccion={setAccionActiva}
      />
    </PantallaListado>
  );
}
