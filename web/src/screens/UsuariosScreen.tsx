import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal } from 'lucide-react';
import {
  Badge,
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  Modal,
  SegmentedControl,
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
import { cambiarRol, ROL, type Rol } from '../repositories/profileRepository';
import styles from './UsuariosScreen.module.css';

const TAMANO_ICONO = 18;

const ADVERTENCIA_SUPERADMIN =
  'Va a tener acceso total, incluida la gestión de usuarios.';

const MOTIVO_ROL_PROPIO =
  'No podés cambiar tu propio rol: un superadmin no puede degradarse a sí mismo';

const MOTIVO_ULTIMO_SUPERADMIN = 'Único superadmin: promové otro antes de degradarlo';

// El alta de usuarios necesita la Auth Admin API (service_role), fuera de alcance
// en v1 (issue #136). "Agregar usuario" sólo informa de la vía válida hoy.
const NOTA_ALTA =
  'En esta versión, las personas se dan de alta desde el dashboard de Supabase. ' +
  'Una vez creadas, aparecen acá para asignarles rol.';

const ROLES: Array<{ valor: Rol; etiqueta: string }> = [
  { valor: ROL.TECNICO, etiqueta: 'Técnico' },
  { valor: ROL.ADMIN, etiqueta: 'Admin' },
  { valor: ROL.SUPERADMIN, etiqueta: 'Superadmin' },
];

const ETIQUETA_ROL: Record<Rol, string> = {
  [ROL.SUPERADMIN]: 'Superadmin',
  [ROL.ADMIN]: 'Admin',
  [ROL.TECNICO]: 'Técnico',
};

/** Clase del avatar según rol (mismos tripletes que el Badge de rol). */
const CLASE_AVATAR_ROL: Record<Rol, string> = {
  [ROL.SUPERADMIN]: styles.avatarSuperadmin,
  [ROL.ADMIN]: styles.avatarAdmin,
  [ROL.TECNICO]: styles.avatarTecnico,
};

type Filtro = 'todos' | 'admins' | 'tecnicos';
type FiltroEstado = 'todos' | 'activos' | 'inactivos';

const ETIQUETA_ESTADO = { activo: 'Activo', inactivo: 'Inactivo' } as const;

/** Nombre visible: un perfil sin nombre se identifica por el id corto. */
function nombreVisible(usuario: UsuarioConAsignaciones): string {
  return usuario.nombre || usuario.id.slice(0, 8);
}

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
  { value: 'todos', label: 'Todos' },
  { value: 'admins', label: 'Admins' },
  { value: 'tecnicos', label: 'Técnicos' },
];

const OPCIONES_FILTRO_ESTADO: Array<{ value: FiltroEstado; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
];

/** Por qué la acción "Cambiar rol" está deshabilitada (null = habilitada). */
function motivoAccionDeshabilitada(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  totalSuperadmins: number,
): string | null {
  if (usuario.id === idActual) return MOTIVO_ROL_PROPIO;
  if (usuario.rol === ROL.SUPERADMIN && totalSuperadmins === 1) return MOTIVO_ULTIMO_SUPERADMIN;
  return null;
}

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

function MenuAcciones({
  usuario,
  idActual,
  totalSuperadmins,
  onCambiar,
}: {
  usuario: UsuarioConAsignaciones;
  idActual: string | undefined;
  totalSuperadmins: number;
  onCambiar: (usuario: UsuarioConAsignaciones) => void;
}) {
  const motivo = motivoAccionDeshabilitada(usuario, idActual, totalSuperadmins);
  return (
    <button
      type="button"
      className={styles.menu}
      disabled={motivo !== null}
      title={motivo ?? 'Cambiar rol'}
      aria-label={`Cambiar rol de ${nombreVisible(usuario)}`}
      onClick={() => onCambiar(usuario)}
    >
      <MoreHorizontal size={TAMANO_ICONO} aria-hidden />
    </button>
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
  onCambiar: (usuario: UsuarioConAsignaciones) => void,
  idActual: string | undefined,
  totalSuperadmins: number,
): TableColumn<UsuarioConAsignaciones> {
  return {
    key: 'acciones',
    header: '',
    align: 'right',
    render: (usuario) => (
      <MenuAcciones
        usuario={usuario}
        idActual={idActual}
        totalSuperadmins={totalSuperadmins}
        onCambiar={onCambiar}
      />
    ),
  };
}

function CuerpoCambiarRol({
  rol,
  onCambiar,
  advertencia,
  errorEnvio,
}: {
  rol: Rol;
  onCambiar: (rol: Rol) => void;
  advertencia: boolean;
  errorEnvio: string | null;
}) {
  return (
    <>
      <Select
        label="Nuevo rol"
        value={rol}
        onChange={(event) => onCambiar(event.target.value as Rol)}
      >
        {ROLES.map(({ valor, etiqueta }) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>
      {advertencia && (
        <p className={styles.advertencia} role="status">
          {ADVERTENCIA_SUPERADMIN}
        </p>
      )}
      {errorEnvio && (
        <p className={styles.errorEnvio} role="alert">
          {errorEnvio}
        </p>
      )}
    </>
  );
}

function CambiarRolModal({
  usuario,
  onClose,
}: {
  usuario: UsuarioConAsignaciones;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const mutacion = useMutation({
    mutationFn: () => cambiarRol(usuario.id, rol),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (error: Error) => setErrorEnvio(error.message),
  });
  return (
    <Modal open title={`Cambiar rol de ${nombreVisible(usuario)}`} onClose={onClose}>
      <div className={styles.form}>
        <CuerpoCambiarRol
          rol={rol}
          onCambiar={setRol}
          advertencia={rol === ROL.SUPERADMIN && usuario.rol !== ROL.SUPERADMIN}
          errorEnvio={errorEnvio}
        />
        <div className={styles.acciones}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={rol === usuario.rol}
            loading={mutacion.isPending}
            onClick={() => mutacion.mutate()}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** "Agregar usuario" no crea cuentas (necesita la Auth Admin API, issue #136):
 *  sólo explica la vía de alta vigente en v1. */
function AgregarUsuarioModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal open title="Agregar usuario" onClose={onClose}>
      <p className={styles.info}>{NOTA_ALTA}</p>
      <div className={styles.acciones}>
        <Button type="button" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </Modal>
  );
}

export function UsuariosScreen() {
  const { perfil } = useAuth();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<UsuarioConAsignaciones | null>(null);
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuariosConAsignaciones,
  });

  const totalSuperadmins = useMemo(
    () => data?.filter((usuario) => usuario.rol === ROL.SUPERADMIN).length ?? 0,
    [data],
  );
  const columnas = useMemo(
    () => [...COLUMNAS, columnaAcciones(setUsuarioEnEdicion, perfil?.id, totalSuperadmins)],
    [perfil?.id, totalSuperadmins],
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
        <div className={styles.filtros}>
          <SegmentedControl
            aria-label="Filtrar por rol"
            options={OPCIONES_FILTRO}
            value={filtro}
            onChange={setFiltro}
          />
          <SegmentedControl
            aria-label="Filtrar por estado"
            options={OPCIONES_FILTRO_ESTADO}
            value={filtroEstado}
            onChange={setFiltroEstado}
          />
        </div>
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
                emptyMessage="No hay usuarios con ese rol"
              />
            </div>
          ))}
      </div>
      {usuarioEnEdicion && (
        <CambiarRolModal usuario={usuarioEnEdicion} onClose={() => setUsuarioEnEdicion(null)} />
      )}
      {agregarAbierto && <AgregarUsuarioModal onClose={() => setAgregarAbierto(false)} />}
    </section>
  );
}
