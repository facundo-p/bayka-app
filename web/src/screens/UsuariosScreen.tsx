import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  BarraFiltros,
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  Select,
  Table,
  Topbar,
  type TableColumn,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { iniciales } from '../lib/iniciales';
import { cx } from '../lib/classNames';
import {
  listarUsuariosConAsignaciones,
  type UsuarioConAsignaciones,
} from '../queries/usuarioQueries';
import { ROL, type Rol } from '../repositories/profileRepository';
import { desactivarUsuario, reactivarUsuario, reenviarInvitacion } from '../services/adminUsersService';
import { contarSuperadminsActivos, itemsDeMenu, type AccionUsuario } from './usuarios/acciones';
import { AgregarUsuarioModal } from './usuarios/AgregarUsuarioModal';
import { CambiarPasswordModal } from './usuarios/CambiarPasswordModal';
import { ConfirmarModal } from './usuarios/ConfirmarModal';
import { EditarUsuarioModal } from './usuarios/EditarUsuarioModal';
import { MenuAccionesUsuario } from './usuarios/MenuAccionesUsuario';
import { ETIQUETA_ROL, nombreVisible } from './usuarios/presentacion';
import styles from './UsuariosScreen.module.css';

/** Clase del avatar según rol (mismos tripletes que el Badge de rol). */
const CLASE_AVATAR_ROL: Record<Rol, string> = {
  [ROL.SUPERADMIN]: styles.avatarSuperadmin,
  [ROL.ADMIN]: styles.avatarAdmin,
  [ROL.TECNICO]: styles.avatarTecnico,
};

type Filtro = 'todos' | 'admins' | 'tecnicos';
type FiltroEstado = 'todos' | 'activos' | 'inactivos';

const ETIQUETA_ESTADO = { activo: 'Activo', inactivo: 'Inactivo' } as const;

/** Resumen de plantaciones (el schema sólo da un conteo, no los nombres):
 *  superadmin ve todas; el resto, "N plantaciones" o "Sin plantaciones". */
function resumenPlantaciones(usuario: UsuarioConAsignaciones): string {
  if (usuario.rol === ROL.SUPERADMIN) return 'Todas';
  if (usuario.plantacionesAsignadas === 0) return 'Sin plantaciones';
  return `${usuario.plantacionesAsignadas} plantaciones`;
}

/** Subtítulo con conteos por rol; pluraliza "persona(s)". */
function calcularSubtitulo(usuarios: UsuarioConAsignaciones[]): string {
  const superadmins = usuarios.filter((usuario) => usuario.rol === ROL.SUPERADMIN).length;
  const admins = usuarios.filter((usuario) => usuario.rol === ROL.ADMIN).length;
  const tecnicos = usuarios.filter((usuario) => usuario.rol === ROL.TECNICO).length;
  const personas = usuarios.length === 1 ? 'persona' : 'personas';
  return (
    `${usuarios.length} ${personas} · ${superadmins} superadmin · ` +
    `${admins} ${admins === 1 ? 'admin' : 'admins'} · ` +
    `${tecnicos} ${tecnicos === 1 ? 'técnico' : 'técnicos'}`
  );
}

/** Filtro cliente por rol. "Admins" agrupa admin+superadmin (ambos con acceso
 *  de gestión); "Técnicos" sólo técnicos; "Todos" sin filtro. */
function filtrarPorRol(usuarios: UsuarioConAsignaciones[], filtro: Filtro): UsuarioConAsignaciones[] {
  if (filtro === 'admins') {
    return usuarios.filter((u) => u.rol === ROL.ADMIN || u.rol === ROL.SUPERADMIN);
  }
  if (filtro === 'tecnicos') return usuarios.filter((u) => u.rol === ROL.TECNICO);
  return usuarios;
}

/** Filtro cliente por estado; compone con el de rol. */
function filtrarPorEstado(
  usuarios: UsuarioConAsignaciones[],
  filtro: FiltroEstado,
): UsuarioConAsignaciones[] {
  if (filtro === 'activos') return usuarios.filter((u) => u.activo);
  if (filtro === 'inactivos') return usuarios.filter((u) => !u.activo);
  return usuarios;
}

const OPCIONES_FILTRO: Array<{ value: Filtro; label: string }> = [
  { value: 'todos', label: 'Rol: todos' },
  { value: 'admins', label: 'Admins' },
  { value: 'tecnicos', label: 'Técnicos' },
];

const OPCIONES_FILTRO_ESTADO: Array<{ value: FiltroEstado; label: string }> = [
  { value: 'todos', label: 'Estado: todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
];

function CeldaUsuario({ usuario }: { usuario: UsuarioConAsignaciones }) {
  return (
    <div className={styles.usuario}>
      <span className={cx(styles.avatar, CLASE_AVATAR_ROL[usuario.rol])} aria-hidden>
        {iniciales(nombreVisible(usuario))}
      </span>
      <span className={styles.usuarioTexto}>
        <span className={styles.nombre}>{nombreVisible(usuario)}</span>
        {/* Email como identificador secundario; perfiles previos al backfill
            de la migración 026 caen a la organización. */}
        {(usuario.email ?? usuario.organizacionNombre) && (
          <span className={styles.organizacion}>
            {usuario.email ?? usuario.organizacionNombre}
          </span>
        )}
      </span>
    </div>
  );
}

const COLUMNAS: Array<TableColumn<UsuarioConAsignaciones>> = [
  { key: 'usuario', header: 'Usuario', render: (usuario) => <CeldaUsuario usuario={usuario} /> },
  {
    key: 'rol',
    header: 'Rol',
    render: (usuario) => <Badge variant={usuario.rol}>{ETIQUETA_ROL[usuario.rol]}</Badge>,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (usuario) => (
      <Badge variant={usuario.activo ? 'activa' : 'neutral'} dot>
        {usuario.activo ? ETIQUETA_ESTADO.activo : ETIQUETA_ESTADO.inactivo}
      </Badge>
    ),
  },
  {
    key: 'plantaciones',
    header: 'Plantaciones',
    render: (usuario) => resumenPlantaciones(usuario),
  },
];

function columnaAcciones(
  onAccion: (usuario: UsuarioConAsignaciones, accion: AccionUsuario) => void,
  idActual: string | undefined,
  superadminsActivos: number,
): TableColumn<UsuarioConAsignaciones> {
  return {
    key: 'acciones',
    header: '',
    align: 'right',
    render: (usuario) => (
      <MenuAccionesUsuario
        nombre={nombreVisible(usuario)}
        items={itemsDeMenu(usuario, idActual, superadminsActivos)}
        onAccion={(accion) => onAccion(usuario, accion)}
      />
    ),
  };
}

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
  idActual,
  superadminsActivos,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  accion: AccionUsuario;
  idActual: string | undefined;
  superadminsActivos: number;
  onClose: () => void;
}) {
  const nombre = nombreVisible(usuario);
  switch (accion) {
    case 'editar':
      return (
        <EditarUsuarioModal
          usuario={usuario}
          idActual={idActual}
          superadminsActivos={superadminsActivos}
          onClose={onClose}
        />
      );
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
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [accionActiva, setAccionActiva] = useState<{
    usuario: UsuarioConAsignaciones;
    accion: AccionUsuario;
  } | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuariosConAsignaciones,
  });

  const superadminsActivos = useMemo(() => contarSuperadminsActivos(data ?? []), [data]);
  const columnas = useMemo(
    () => [
      ...COLUMNAS,
      columnaAcciones(
        (usuario, accion) => setAccionActiva({ usuario, accion }),
        perfil?.id,
        superadminsActivos,
      ),
    ],
    [perfil?.id, superadminsActivos],
  );

  return (
    <section>
      <Topbar
        left={<span className={styles.rotulo}>Organización · Equipo</span>}
        right={<Button onClick={() => setAgregarAbierto(true)}>Agregar usuario</Button>}
      />
      <div className={styles.body}>
        <h1 className={styles.titulo}>Usuarios</h1>
        {data && <p className={styles.subtitulo}>{calcularSubtitulo(data)}</p>}
        <BarraFiltros>
          <Select
            label="Filtrar por rol"
            labelOculto
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value as Filtro)}
          >
            {OPCIONES_FILTRO.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Filtrar por estado"
            labelOculto
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value as FiltroEstado)}
          >
            {OPCIONES_FILTRO_ESTADO.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </BarraFiltros>
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
            <div className={styles.tablaScroll}>
              <Table
                columns={columnas}
                rows={filtrarPorEstado(filtrarPorRol(data, filtro), filtroEstado)}
                getRowKey={(usuario) => usuario.id}
                emptyMessage="No hay usuarios con esos filtros"
              />
            </div>
          ))}
      </div>
      {accionActiva && (
        <ModalDeAccion
          usuario={accionActiva.usuario}
          accion={accionActiva.accion}
          idActual={perfil?.id}
          superadminsActivos={superadminsActivos}
          onClose={() => setAccionActiva(null)}
        />
      )}
      {agregarAbierto && <AgregarUsuarioModal onClose={() => setAgregarAbierto(false)} />}
    </section>
  );
}
