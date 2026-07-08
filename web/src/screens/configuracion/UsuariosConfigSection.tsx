import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Badge, Button, Card, Cargando, ErrorConReintento, Modal, Select } from '../../components';
import { iniciales } from '../../lib/iniciales';
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
import { ROL } from '../../repositories/profileRepository';
import { CabeceraConfig } from './CabeceraConfig';
import styles from './SeccionesConfig.module.css';

const ROLES_EN_PLANTACION: RolEnPlantacion[] = [ROL.TECNICO, ROL.ADMIN];

const ETIQUETA_ROL: Record<string, string> = {
  [ROL.TECNICO]: 'Técnico',
  [ROL.ADMIN]: 'Admin',
  [ROL.SUPERADMIN]: 'Superadmin',
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

function FilaAsignado({
  asignado,
  onQuitar,
}: {
  asignado: UsuarioAsignado;
  onQuitar: (asignado: UsuarioAsignado) => void;
}) {
  const nombre = nombreVisible(asignado.nombre, asignado.userId);
  return (
    <li className={styles.filaTecnico}>
      <span className={styles.avatar} aria-hidden>
        {iniciales(nombre)}
      </span>
      <span className={styles.nombreTecnico}>{nombre}</span>
      <Badge>{etiquetaRol(asignado.rolEnPlantacion)}</Badge>
      <button
        type="button"
        className={styles.quitarTecnico}
        aria-label={`Quitar ${nombre}`}
        onClick={() => onQuitar(asignado)}
      >
        <X size={16} />
      </button>
    </li>
  );
}

function ModalAsignar({
  plantationId,
  disponibles,
  onCerrar,
}: {
  plantationId: string;
  disponibles: PerfilResumen[];
  onCerrar: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [rol, setRol] = useState<RolEnPlantacion>(ROL.TECNICO);
  const invalidar = useInvalidarUsuarios(plantationId);
  const mutacion = useMutation({
    mutationFn: () => asignarUsuario(plantationId, userId, rol),
    onSuccess: async () => {
      await invalidar();
      onCerrar();
    },
  });
  const mensajeError = mensajeErrorAsignar(mutacion.error);

  return (
    <Modal open title="Asignar técnico" onClose={onCerrar}>
      <div className={styles.formModal}>
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
      </div>
      {mensajeError && (
        <p className={styles.errorAccion} role="alert">
          {mensajeError}
        </p>
      )}
      <div className={styles.acciones}>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button onClick={() => mutacion.mutate()} disabled={!userId} loading={mutacion.isPending}>
          Asignar
        </Button>
      </div>
    </Modal>
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
  const [asignando, setAsignando] = useState(false);
  return (
    <>
      {asignados.length === 0 ? (
        <p className={styles.textoAyuda}>Sin técnicos asignados: nadie ve esta plantación en la app.</p>
      ) : (
        <ul className={styles.listaTecnicos}>
          {asignados.map((asignado) => (
            <FilaAsignado key={asignado.userId} asignado={asignado} onQuitar={setAQuitar} />
          ))}
        </ul>
      )}
      <button type="button" className={styles.botonAsignar} onClick={() => setAsignando(true)}>
        <Plus size={16} />
        Asignar técnico
      </button>
      {asignando && (
        <ModalAsignar
          plantationId={plantationId}
          disponibles={perfilesNoAsignados(perfiles, asignados)}
          onCerrar={() => setAsignando(false)}
        />
      )}
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
    <Card>
      <CabeceraConfig titulo="Técnicos asignados" subtitulo="Quién puede registrar en esta plantación" />
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
