import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Cargando,
  ErrorConReintento,
  Modal,
  PageHeader,
  Select,
  Table,
  type TableColumn,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { formatearFechaCorta } from '../lib/fechas';
import {
  listarUsuariosConAsignaciones,
  type UsuarioConAsignaciones,
} from '../queries/usuarioQueries';
import { cambiarRol, type Rol } from '../repositories/profileRepository';
import styles from './UsuariosScreen.module.css';

const NOTA_ALTA = 'El alta de usuarios se hace desde el dashboard de Supabase.';

const ADVERTENCIA_SUPERADMIN =
  'Va a tener acceso total, incluida la gestión de usuarios.';

const MOTIVO_ROL_PROPIO =
  'No podés cambiar tu propio rol: un superadmin no puede degradarse a sí mismo';

const MOTIVO_ULTIMO_SUPERADMIN = 'Único superadmin: promové otro antes de degradarlo';

const ROLES: Array<{ valor: Rol; etiqueta: string }> = [
  { valor: 'tecnico', etiqueta: 'Técnico' },
  { valor: 'admin', etiqueta: 'Admin' },
  { valor: 'superadmin', etiqueta: 'Superadmin' },
];

/** Variantes existentes del Badge: el azul de "finalizada" distingue al superadmin. */
const VARIANTE_ROL: Record<Rol, 'finalizada' | 'neutral'> = {
  superadmin: 'finalizada',
  admin: 'neutral',
  tecnico: 'neutral',
};

/** Nombre visible: un perfil sin nombre se identifica por el id corto. */
function nombreVisible(usuario: UsuarioConAsignaciones): string {
  return usuario.nombre || usuario.id.slice(0, 8);
}

/** Por qué la acción "Cambiar rol" está deshabilitada (null = habilitada). */
function motivoAccionDeshabilitada(
  usuario: UsuarioConAsignaciones,
  idActual: string | undefined,
  totalSuperadmins: number,
): string | null {
  if (usuario.id === idActual) return MOTIVO_ROL_PROPIO;
  if (usuario.rol === 'superadmin' && totalSuperadmins === 1) return MOTIVO_ULTIMO_SUPERADMIN;
  return null;
}

const COLUMNAS: Array<TableColumn<UsuarioConAsignaciones>> = [
  { key: 'nombre', header: 'Nombre', render: (usuario) => nombreVisible(usuario) },
  {
    key: 'rol',
    header: 'Rol',
    render: (usuario) => <Badge variant={VARIANTE_ROL[usuario.rol]}>{usuario.rol}</Badge>,
  },
  {
    key: 'organizacion',
    header: 'Organización',
    render: (usuario) => usuario.organizacionNombre || '—',
  },
  {
    key: 'plantaciones',
    header: 'Plantaciones asignadas',
    align: 'right',
    render: (usuario) => String(usuario.plantacionesAsignadas),
  },
  { key: 'alta', header: 'Alta', render: (usuario) => formatearFechaCorta(usuario.createdAt) },
];

function columnaCambiarRol(
  onCambiar: (usuario: UsuarioConAsignaciones) => void,
  idActual: string | undefined,
  totalSuperadmins: number,
): TableColumn<UsuarioConAsignaciones> {
  return {
    key: 'acciones',
    header: '',
    align: 'right',
    render: (usuario) => {
      const motivo = motivoAccionDeshabilitada(usuario, idActual, totalSuperadmins);
      return (
        <Button
          variant="secondary"
          size="sm"
          disabled={motivo !== null}
          title={motivo ?? undefined}
          onClick={() => onCambiar(usuario)}
        >
          Cambiar rol
        </Button>
      );
    },
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
          advertencia={rol === 'superadmin' && usuario.rol !== 'superadmin'}
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

export function UsuariosScreen() {
  const { perfil } = useAuth();
  const [usuarioEnEdicion, setUsuarioEnEdicion] = useState<UsuarioConAsignaciones | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuariosConAsignaciones,
  });
  const totalSuperadmins =
    data?.filter((usuario) => usuario.rol === 'superadmin').length ?? 0;

  return (
    <section>
      <PageHeader title="Usuarios" subtitle={NOTA_ALTA} />
      {isPending && <Cargando />}
      {isError && !data && (
        <ErrorConReintento
          mensaje="No se pudieron cargar los usuarios."
          onReintentar={() => void refetch()}
        />
      )}
      {data && (
        <Table
          columns={[...COLUMNAS, columnaCambiarRol(setUsuarioEnEdicion, perfil?.id, totalSuperadmins)]}
          rows={data}
          getRowKey={(usuario) => usuario.id}
          emptyMessage="Sin usuarios para mostrar"
        />
      )}
      {usuarioEnEdicion && (
        <CambiarRolModal usuario={usuarioEnEdicion} onClose={() => setUsuarioEnEdicion(null)} />
      )}
    </section>
  );
}
