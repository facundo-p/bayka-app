import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import {
  Badge,
  Button,
  Cargando,
  ErrorConReintento,
  Modal,
  SelectConDetalle,
  type OpcionConDetalle,
} from '../../components';
import { useInvalidarAsignacion } from '../../hooks/useInvalidarAsignacion';
import { usePerfiles } from '../../hooks/usePerfiles';
import { iniciales } from '../../lib/iniciales';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  listarAsignados,
  type PerfilResumen,
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

const ETIQUETA_ROL: Record<string, string> = {
  [ROL.TECNICO]: 'Técnico',
  [ROL.ADMIN]: 'Admin',
  [ROL.SUPERADMIN]: 'Superadmin',
};

const LARGO_ID_CORTO = 8;

const AYUDA_ASIGNAR = 'Se asigna como técnico. Los admins ya ven todas las plantaciones.';

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
  // Solo técnicos activos: los admins ya son miembros automáticos de todas las
  // plantaciones (#67) y un usuario dado de baja no puede loguearse.
  return perfiles.filter(
    (perfil) => perfil.activo && perfil.rol === ROL.TECNICO && !idsAsignados.has(perfil.id),
  );
}

/** El email desambigua nombres repetidos. */
function opcionesDeUsuario(perfiles: PerfilResumen[]): OpcionConDetalle[] {
  return perfiles.map((perfil) => ({
    valor: perfil.id,
    principal: nombreVisible(perfil.nombre, perfil.id),
    secundario: perfil.email,
  }));
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
  const invalidar = useInvalidarAsignacion(plantationId, userId);
  const mutacion = useMutation({
    mutationFn: () => asignarUsuario(plantationId, userId),
    onSuccess: async () => {
      await invalidar();
      onCerrar();
    },
  });
  const mensajeError = mensajeErrorAsignar(mutacion.error);

  return (
    <Modal open title="Asignar técnico" onClose={onCerrar}>
      <div className={styles.formModal}>
        <SelectConDetalle
          label="Técnico"
          value={userId}
          onChange={setUserId}
          opciones={opcionesDeUsuario(disponibles)}
          placeholder="Elegí un técnico"
          placeholderBusqueda="Buscar por nombre o email"
          textoVacio="No quedan técnicos para asignar."
          textoSinCoincidencias="Ningún técnico coincide."
          hint={AYUDA_ASIGNAR}
        />
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
  const invalidar = useInvalidarAsignacion(plantationId, asignado.userId);
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

const TITULO = 'Técnicos asignados';
const SUBTITULO = 'Quién puede registrar en esta plantación';

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
      <CabeceraConfig
        titulo={TITULO}
        subtitulo={SUBTITULO}
        chip={`${asignados.length} asignados`}
        acciones={
          <button type="button" className={styles.botonAsignar} onClick={() => setAsignando(true)}>
            <Plus size={16} aria-hidden />
            Asignar técnico
          </button>
        }
      />
      {asignados.length === 0 ? (
        <p className={styles.listaVacia}>
          Sin técnicos asignados: nadie ve esta plantación en la app.
        </p>
      ) : (
        <ul className={styles.listaTecnicos}>
          {asignados.map((asignado) => (
            <FilaAsignado key={asignado.userId} asignado={asignado} onQuitar={setAQuitar} />
          ))}
        </ul>
      )}
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
  const perfiles = usePerfiles();
  const asignados = useQuery({
    queryKey: CLAVE_QUERY.plantacionUsuarios(id),
    queryFn: () => listarAsignados(id),
  });
  const reintentar = () => void Promise.all([perfiles.refetch(), asignados.refetch()]);

  return (
    <section className={styles.cardTecnicos}>
      {(perfiles.isPending || asignados.isPending) && (
        <>
          <CabeceraConfig titulo={TITULO} subtitulo={SUBTITULO} />
          <Cargando />
        </>
      )}
      {(perfiles.isError || asignados.isError) && (
        <>
          <CabeceraConfig titulo={TITULO} subtitulo={SUBTITULO} />
          <div className={styles.bloqueEstado}>
            <ErrorConReintento
              mensaje="No se pudieron cargar los usuarios."
              onReintentar={reintentar}
            />
          </div>
        </>
      )}
      {perfiles.data && asignados.data && (
        <ContenidoUsuarios plantationId={id} perfiles={perfiles.data} asignados={asignados.data} />
      )}
    </section>
  );
}
