import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  Button,
  CabeceraSeccion,
  CardTabla,
  Cargando,
  EmptyState,
  ErrorConReintento,
  LayoutConPanel,
  Table,
  Topbar,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import {
  listarUsuariosConAsignaciones,
  type UsuarioConAsignaciones,
} from '../queries/usuarioQueries';
import { desactivarUsuario, reactivarUsuario, reenviarInvitacion } from '../services/adminUsersService';
import { contarSuperadminsActivos, type AccionUsuario } from './usuarios/acciones';
import { AgregarUsuarioModal } from './usuarios/AgregarUsuarioModal';
import { CambiarPasswordModal } from './usuarios/CambiarPasswordModal';
import { columnasUsuarios } from './usuarios/columnas';
import { useColumnasVisibles } from '../hooks/useColumnasVisibles';
import { ConfirmarModal } from './usuarios/ConfirmarModal';
import {
  calcularMeta,
  contarActivas,
  FILTRO_ESTADO,
  FILTRO_ROL,
  filtrarUsuarios,
  type FiltroEstado,
  type FiltroRol,
} from './usuarios/filtros';
import { nombreVisible } from './usuarios/presentacion';
import { UsuarioPanel } from './usuarios/UsuarioPanel';
import { UsuariosToolbar } from './usuarios/UsuariosToolbar';
import styles from './usuarios/Usuarios.module.css';

const DEBOUNCE_BUSQUEDA_MS = 200;

const PIE_AYUDA = 'clic en una fila abre el detalle en el panel lateral · ⋯ para acciones rápidas';
const PIE_NOTA = 'Las personas inactivas aparecen atenuadas';

/** Copys de confirmación: explican qué se pierde y qué se conserva. */
function copyDesactivar(nombre: string): string {
  return (
    `${nombre} va a perder el acceso a la app y a la web en cuanto su sesión se renueve. ` +
    'Si está trabajando sin conexión, sigue operando hasta reconectar. ' +
    'Sus datos de campo (árboles y grupos registrados) se conservan. Se puede reactivar.'
  );
}

function ModalDeAccion({
  usuario,
  accion,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  accion: AccionUsuario;
  onClose: () => void;
}) {
  const nombre = nombreVisible(usuario);
  switch (accion) {
    case 'cambiarPassword':
      return <CambiarPasswordModal usuario={usuario} onClose={onClose} />;
    case 'reenviarInvitacion':
      return (
        <ConfirmarModal
          titulo={`Reenviar invitación a ${nombre}`}
          descripcion={`Le va a llegar un email a ${usuario.email ?? ''} para definir su contraseña.`}
          confirmarEtiqueta="Reenviar"
          accion={() => reenviarInvitacion(usuario.email ?? '')}
          textoExito="Invitación enviada."
          onClose={onClose}
        />
      );
    case 'desactivar':
      return (
        <ConfirmarModal
          titulo={`Desactivar a ${nombre}`}
          descripcion={copyDesactivar(nombre)}
          confirmarEtiqueta="Desactivar"
          destructiva
          accion={() => desactivarUsuario(usuario.id)}
          onClose={onClose}
        />
      );
    case 'reactivar':
      return (
        <ConfirmarModal
          titulo={`Reactivar a ${nombre}`}
          descripcion={`${nombre} va a recuperar el acceso que tenía según su rol.`}
          confirmarEtiqueta="Reactivar"
          accion={() => reactivarUsuario(usuario.id)}
          onClose={onClose}
        />
      );
  }
}

export function UsuariosScreen() {
  const { perfil } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState<FiltroRol>(FILTRO_ROL.todos);
  const [estado, setEstado] = useState<FiltroEstado>(FILTRO_ESTADO.todos);
  const [seleccionado, setSeleccionado] = useState<UsuarioConAsignaciones | null>(null);
  const [accionActiva, setAccionActiva] = useState<{
    usuario: UsuarioConAsignaciones;
    accion: AccionUsuario;
  } | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const busquedaDemorada = useDebounce(busqueda, DEBOUNCE_BUSQUEDA_MS);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuariosConAsignaciones,
  });

  const superadminsActivos = useMemo(() => contarSuperadminsActivos(data ?? []), [data]);
  const columnas = useMemo(
    () =>
      columnasUsuarios(
        (usuario, accion) => setAccionActiva({ usuario, accion }),
        perfil?.id,
        superadminsActivos,
      ),
    [perfil?.id, superadminsActivos],
  );
  const columnasVisibles = useColumnasVisibles(columnas);
  const visibles = useMemo(
    () => filtrarUsuarios(data ?? [], { busqueda: busquedaDemorada, rol, estado }),
    [data, busquedaDemorada, rol, estado],
  );

  return (
    <section className={styles.pantalla}>
      <Topbar
        densidad="compacta"
        left={
          <CabeceraSeccion
            raiz="Organización"
            titulo="Usuarios"
            meta={data ? calcularMeta(data) : undefined}
          />
        }
        right={
          <Button size="sm" onClick={() => setAgregarAbierto(true)}>
            <Plus size={16} aria-hidden />
            Agregar usuario
          </Button>
        }
      />
      <div className={styles.contenido}>
        <UsuariosToolbar
          busqueda={busqueda}
          rol={rol}
          estado={estado}
          onBuscar={setBusqueda}
          onRol={setRol}
          onEstado={setEstado}
          personas={visibles.length}
          activas={contarActivas(visibles)}
        />
        {isPending && <Cargando />}
        {isError && !data && (
          <ErrorConReintento
            mensaje="No se pudieron cargar los usuarios."
            onReintentar={() => void refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              title="Sin usuarios"
              description="Las personas de tu organización van a aparecer acá."
            />
          ) : (
            <LayoutConPanel
              panel={
                seleccionado && (
                  <UsuarioPanel
                    // Remonta el panel al cambiar de fila: los campos se
                    // reinicializan con los datos de la nueva persona.
                    key={seleccionado.id}
                    usuario={seleccionado}
                    idActual={perfil?.id}
                    superadminsActivos={superadminsActivos}
                    onAccion={(accion) => setAccionActiva({ usuario: seleccionado, accion })}
                    onCerrar={() => setSeleccionado(null)}
                  />
                )
              }
            >
              <CardTabla
                pie={`${visibles.length} ${visibles.length === 1 ? 'persona' : 'personas'} · ${PIE_AYUDA}`}
                pieDerecha={PIE_NOTA}
              >
                <Table
                  columns={columnasVisibles}
                  rows={visibles}
                  getRowKey={(usuario) => usuario.id}
                  claveSeleccionada={seleccionado?.id}
                  onRowClick={setSeleccionado}
                  emptyMessage="No hay usuarios con esos filtros"
                />
              </CardTabla>
            </LayoutConPanel>
          ))}
      </div>
      {accionActiva && (
        <ModalDeAccion
          usuario={accionActiva.usuario}
          accion={accionActiva.accion}
          onClose={() => setAccionActiva(null)}
        />
      )}
      {agregarAbierto && <AgregarUsuarioModal onClose={() => setAgregarAbierto(false)} />}
    </section>
  );
}
