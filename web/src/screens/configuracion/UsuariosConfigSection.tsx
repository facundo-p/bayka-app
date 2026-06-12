import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Cargando,
  ErrorConReintento,
  Modal,
  Select,
  Table,
  type TableColumn,
} from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import {
  listarAsignados,
  listarPerfiles,
  type PerfilResumen,
  type RolEnPlantacion,
  type UsuarioAsignado,
} from '../../queries/usuarioQueries';
import {
  asignarUsuario,
  desasignarUsuario,
  MENSAJE_USUARIO_YA_ASIGNADO,
} from '../../repositories/plantationUserRepository';
import styles from './UsuariosConfigSection.module.css';

const ROLES_EN_PLANTACION: RolEnPlantacion[] = ['tecnico', 'admin'];

/** Etiquetas en español de los roles (globales y en plantación). */
const ETIQUETA_ROL: Record<string, string> = {
  tecnico: 'Técnico',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

const LARGO_ID_CORTO = 8;

function etiquetaRol(rol: string): string {
  return ETIQUETA_ROL[rol] ?? rol;
}

/** Nombre visible: si el perfil no tiene nombre, el id corto. */
function nombreVisible(nombre: string, id: string): string {
  return nombre.trim() || id.slice(0, LARGO_ID_CORTO);
}

function perfilesNoAsignados(
  perfiles: PerfilResumen[],
  asignados: UsuarioAsignado[],
): PerfilResumen[] {
  const idsAsignados = new Set(asignados.map((asignado) => asignado.userId));
  return perfiles.filter((perfil) => !idsAsignados.has(perfil.id));
}

function columnasAsignados(
  onQuitar: (asignado: UsuarioAsignado) => void,
): Array<TableColumn<UsuarioAsignado>> {
  return [
    { key: 'nombre', header: 'Nombre', render: (a) => nombreVisible(a.nombre, a.userId) },
    { key: 'rolGlobal', header: 'Rol global', render: (a) => <Badge>{etiquetaRol(a.rolGlobal)}</Badge> },
    { key: 'rolEnPlantacion', header: 'Rol en plantación', render: (a) => etiquetaRol(a.rolEnPlantacion) },
    { key: 'assignedAt', header: 'Asignado', render: (a) => formatearFechaCorta(a.assignedAt) },
    {
      key: 'acciones',
      header: '',
      align: 'right',
      render: (a) => (
        <Button variant="secondary" size="sm" onClick={() => onQuitar(a)}>
          Quitar
        </Button>
      ),
    },
  ];
}

/** Invalida la lista de asignados y el count de usuarios del listado general. */
function useInvalidarUsuarios(plantationId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['plantacion-usuarios', plantationId] }),
      queryClient.invalidateQueries({ queryKey: ['plantaciones'] }),
    ]);
}

function mensajeErrorAsignar(error: Error | null): string | null {
  if (!error) return null;
  return error.message === MENSAJE_USUARIO_YA_ASIGNADO
    ? error.message
    : 'No se pudo asignar el usuario.';
}

function FormAsignar({
  plantationId,
  disponibles,
}: {
  plantationId: string;
  disponibles: PerfilResumen[];
}) {
  const [userId, setUserId] = useState('');
  const [rol, setRol] = useState<RolEnPlantacion>('tecnico');
  const invalidar = useInvalidarUsuarios(plantationId);
  const mutacion = useMutation({
    mutationFn: () => asignarUsuario(plantationId, userId, rol),
    onSuccess: async () => {
      setUserId('');
      await invalidar();
    },
  });
  const mensajeError = mensajeErrorAsignar(mutacion.error);

  return (
    <div className={styles.formAsignar}>
      <div className={styles.filaAsignar}>
        <Select label="Usuario" value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">Elegí un usuario</option>
          {disponibles.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {nombreVisible(perfil.nombre, perfil.id)}
            </option>
          ))}
        </Select>
        <Select
          label="Rol en plantación"
          value={rol}
          onChange={(event) => setRol(event.target.value as RolEnPlantacion)}
        >
          {ROLES_EN_PLANTACION.map((opcion) => (
            <option key={opcion} value={opcion}>
              {etiquetaRol(opcion)}
            </option>
          ))}
        </Select>
        <Button
          onClick={() => mutacion.mutate()}
          disabled={!userId}
          loading={mutacion.isPending}
          className={styles.botonAsignar}
        >
          Asignar
        </Button>
      </div>
      {mensajeError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeError}
        </p>
      )}
    </div>
  );
}

function ModalQuitar({
  plantationId,
  asignado,
  onCerrar,
}: {
  plantationId: string;
  asignado: UsuarioAsignado;
  onCerrar: () => void;
}) {
  const invalidar = useInvalidarUsuarios(plantationId);
  const mutacion = useMutation({
    mutationFn: () => desasignarUsuario(plantationId, asignado.userId),
    onSuccess: async () => {
      await invalidar();
      onCerrar();
    },
  });

  return (
    <Modal open title="Quitar usuario" onClose={onCerrar}>
      <p className={styles.textoConfirmacion}>
        {nombreVisible(asignado.nombre, asignado.userId)} dejará de ver esta plantación en la app.
        Sus árboles registrados se conservan.
      </p>
      {mutacion.isError && (
        <p className={styles.errorAccion} role="alert">
          No se pudo quitar el usuario.
        </p>
      )}
      <div className={styles.acciones}>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="danger" loading={mutacion.isPending} onClick={() => mutacion.mutate()}>
          Quitar
        </Button>
      </div>
    </Modal>
  );
}

function ContenidoUsuarios({
  plantationId,
  perfiles,
  asignados,
}: {
  plantationId: string;
  perfiles: PerfilResumen[];
  asignados: UsuarioAsignado[];
}) {
  const [aQuitar, setAQuitar] = useState<UsuarioAsignado | null>(null);
  return (
    <>
      <Table
        columns={columnasAsignados(setAQuitar)}
        rows={asignados}
        getRowKey={(asignado) => asignado.userId}
        emptyMessage="Sin usuarios asignados: nadie ve esta plantación en la app"
      />
      <FormAsignar
        plantationId={plantationId}
        disponibles={perfilesNoAsignados(perfiles, asignados)}
      />
      {aQuitar && (
        <ModalQuitar
          plantationId={plantationId}
          asignado={aQuitar}
          onCerrar={() => setAQuitar(null)}
        />
      )}
    </>
  );
}

/** Control de acceso de la app: solo los usuarios asignados ven la plantación. */
export function UsuariosConfigSection() {
  const { id = '' } = useParams();
  const perfiles = useQuery({ queryKey: ['perfiles'], queryFn: listarPerfiles });
  const asignados = useQuery({
    queryKey: ['plantacion-usuarios', id],
    queryFn: () => listarAsignados(id),
  });
  const reintentar = () => void Promise.all([perfiles.refetch(), asignados.refetch()]);

  return (
    <Card title="Usuarios asignados">
      {(perfiles.isPending || asignados.isPending) && <Cargando />}
      {(perfiles.isError || asignados.isError) && (
        <ErrorConReintento mensaje="No se pudieron cargar los usuarios." onReintentar={reintentar} />
      )}
      {perfiles.data && asignados.data && (
        <ContenidoUsuarios plantationId={id} perfiles={perfiles.data} asignados={asignados.data} />
      )}
    </Card>
  );
}
