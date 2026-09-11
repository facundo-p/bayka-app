import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import {
  Badge,
  BotonIcono,
  Button,
  Modal,
  SelectConDetalle,
  type OpcionConDetalle,
} from '../../components';
import { useInvalidarAsignacion } from '../../hooks/useInvalidarAsignacion';
import { usePerfiles } from '../../hooks/usePerfiles';
import { iniciales } from '../../lib/iniciales';
import { mensajeErrorConocido } from '../../lib/mensajeErrorConocido';
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
import { CardConfig } from './CardConfig';
import { ErrorAccion } from './ErrorAccion';
import { TAMANO_ICONO } from '../../theme/iconos';
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

const TITULO = 'Técnicos asignados';
const SUBTITULO = 'Quién puede registrar en esta plantación';
const ERROR_ASIGNAR = 'No se pudo asignar el usuario.';
const ERROR_QUITAR = 'No se pudo quitar el usuario.';

/** El modal cierra recién cuando la card, el listado y Usuarios se invalidaron. */
function useMutacionYCerrar(
  plantationId: string,
  userId: string,
  mutationFn: () => Promise<unknown>,
  onCerrar: () => void,
) {
  const invalidar = useInvalidarAsignacion(plantationId, userId);
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await invalidar();
      onCerrar();
    },
  });
}

function PieModal({ onCerrar, children }: { onCerrar: () => void; children: ReactNode }) {
  return (
    <div className={styles.acciones}>
      <Button variant="secondary" onClick={onCerrar}>
        Cancelar
      </Button>
      {children}
    </div>
  );
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
      <BotonIcono
        variante="fantasma"
        destructiva
        etiqueta={`Quitar ${nombre}`}
        onClick={() => onQuitar(asignado)}
      >
        <X size={TAMANO_ICONO.md} />
      </BotonIcono>
    </li>
  );
}

interface SelectTecnicoProps {
  disponibles: PerfilResumen[];
  value: string;
  onChange: (userId: string) => void;
}

function SelectTecnico({ disponibles, value, onChange }: SelectTecnicoProps) {
  return (
    <SelectConDetalle
      label="Técnico"
      value={value}
      onChange={onChange}
      opciones={opcionesDeUsuario(disponibles)}
      placeholder="Elegí un técnico"
      placeholderBusqueda="Buscar por nombre o email"
      textoVacio="No quedan técnicos para asignar."
      textoSinCoincidencias="Ningún técnico coincide."
      hint={AYUDA_ASIGNAR}
    />
  );
}

interface ModalAsignarProps {
  plantationId: string;
  disponibles: PerfilResumen[];
  onCerrar: () => void;
}

function ModalAsignar({ plantationId, disponibles, onCerrar }: ModalAsignarProps) {
  const [userId, setUserId] = useState('');
  const asignar = () => asignarUsuario(plantationId, userId);
  const mutacion = useMutacionYCerrar(plantationId, userId, asignar, onCerrar);
  return (
    <Modal open title="Asignar técnico" onClose={onCerrar}>
      <div className={styles.formModal}>
        <SelectTecnico disponibles={disponibles} value={userId} onChange={setUserId} />
      </div>
      <ErrorAccion
        mensaje={mensajeErrorConocido(mutacion.error, MENSAJE_USUARIO_YA_ASIGNADO, ERROR_ASIGNAR)}
      />
      <PieModal onCerrar={onCerrar}>
        <Button onClick={() => mutacion.mutate()} disabled={!userId} loading={mutacion.isPending}>
          Asignar
        </Button>
      </PieModal>
    </Modal>
  );
}

interface ModalQuitarProps {
  plantationId: string;
  asignado: UsuarioAsignado;
  onCerrar: () => void;
}

function ModalQuitar({ plantationId, asignado, onCerrar }: ModalQuitarProps) {
  const quitar = () => desasignarUsuario(plantationId, asignado.userId);
  const mutacion = useMutacionYCerrar(plantationId, asignado.userId, quitar, onCerrar);
  return (
    <Modal open title="Quitar usuario" onClose={onCerrar}>
      <p className={styles.textoConfirmacion}>
        {nombreVisible(asignado.nombre, asignado.userId)} dejará de ver esta plantación en la app.
        Sus árboles registrados se conservan.
      </p>
      <ErrorAccion mensaje={mutacion.isError ? ERROR_QUITAR : null} />
      <PieModal onCerrar={onCerrar}>
        <Button variant="danger" loading={mutacion.isPending} onClick={() => mutacion.mutate()}>
          Quitar
        </Button>
      </PieModal>
    </Modal>
  );
}

function CabeceraTecnicos({ cantidad, onAsignar }: { cantidad: number; onAsignar: () => void }) {
  const asignar = (
    <button type="button" className={styles.botonAsignar} onClick={onAsignar}>
      <Plus size={TAMANO_ICONO.md} aria-hidden />
      Asignar técnico
    </button>
  );
  return (
    <CabeceraConfig
      titulo={TITULO}
      subtitulo={SUBTITULO}
      chip={`${cantidad} asignados`}
      acciones={asignar}
    />
  );
}

interface ListaAsignadosProps {
  asignados: UsuarioAsignado[];
  onQuitar: (asignado: UsuarioAsignado) => void;
}

function ListaAsignados({ asignados, onQuitar }: ListaAsignadosProps) {
  if (asignados.length === 0) {
    return (
      <p className={styles.listaVacia}>
        Sin técnicos asignados: nadie ve esta plantación en la app.
      </p>
    );
  }
  return (
    <ul className={styles.listaTecnicos}>
      {asignados.map((asignado) => (
        <FilaAsignado key={asignado.userId} asignado={asignado} onQuitar={onQuitar} />
      ))}
    </ul>
  );
}

interface ContenidoUsuariosProps {
  plantationId: string;
  perfiles: PerfilResumen[];
  asignados: UsuarioAsignado[];
}

function ContenidoUsuarios({ plantationId, perfiles, asignados }: ContenidoUsuariosProps) {
  const [aQuitar, setAQuitar] = useState<UsuarioAsignado | null>(null);
  const [asignando, setAsignando] = useState(false);
  const disponibles = perfilesNoAsignados(perfiles, asignados);
  return (
    <>
      <CabeceraTecnicos cantidad={asignados.length} onAsignar={() => setAsignando(true)} />
      <ListaAsignados asignados={asignados} onQuitar={setAQuitar} />
      {asignando && (
        <ModalAsignar
          plantationId={plantationId}
          disponibles={disponibles}
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
  return (
    <CardConfig
      className={styles.cardTecnicos}
      titulo={TITULO}
      subtitulo={SUBTITULO}
      consultas={[perfiles, asignados]}
      mensajeError="No se pudieron cargar los usuarios."
    >
      {perfiles.data && asignados.data && (
        <ContenidoUsuarios plantationId={id} perfiles={perfiles.data} asignados={asignados.data} />
      )}
    </CardConfig>
  );
}
