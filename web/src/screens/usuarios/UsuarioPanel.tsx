import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ban, Key, Mail } from 'lucide-react';
import {
  Button,
  Input,
  PanelBloque,
  PanelIdentidad,
  PanelLateral,
  PanelListaEnlaces,
  Select,
  type EnlacePanel,
} from '../../components';
import { useInvalidarUsuarios } from '../../hooks/useInvalidarUsuarios';
import { formatearFechaDia } from '../../lib/fechas';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  listarPlantacionesDeUsuario,
  type PlantacionDeUsuario,
  type UsuarioConAsignaciones,
} from '../../queries/usuarioQueries';
import { actualizarNombre, cambiarRol, ROL, type Rol } from '../../repositories/profileRepository';
import { cambiarEmail } from '../../services/adminUsersService';
import { emailValido } from '../../../../supabase/functions/admin-users/nucleo';
import { itemsDeMenu, motivoCambiarRol, type AccionUsuario, type ItemMenu } from './acciones';
import { Avatar } from './celdas';
import { ADVERTENCIA_SUPERADMIN, ETIQUETA_ROL, nombreVisible, ROLES } from './presentacion';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './Usuarios.module.css';

const AYUDA_DESACTIVAR =
  'Al desactivar pierde el acceso; sus datos de campo se conservan y se puede reactivar.';
const SIN_ASIGNACIONES = 'Sin plantaciones asignadas';
const ACCESO_TOTAL = 'Acceso a todas las plantaciones';

/** Ícono de cada acción rápida del panel (las mismas que el menú "⋯"). */
const ICONO_ACCION: Partial<Record<AccionUsuario, typeof Key>> = {
  cambiarPassword: Key,
  reenviarInvitacion: Mail,
  desactivar: Ban,
  reactivar: Ban,
};

/** Superadmin y admin son miembros automáticos de todas las plantaciones (#67). */
function accedeATodas(rol: Rol): boolean {
  return rol === ROL.SUPERADMIN || rol === ROL.ADMIN;
}

function CabeceraUsuario({ usuario }: { usuario: UsuarioConAsignaciones }) {
  return (
    <PanelIdentidad
      marca={<Avatar usuario={usuario} clase={styles.avatarGrande} />}
      titulo={nombreVisible(usuario)}
      meta={`${ETIQUETA_ROL[usuario.rol]} · desde ${formatearFechaDia(usuario.createdAt)}`}
    />
  );
}

/** Campo de rol: deshabilitado con el motivo visible cuando el guard aplica
 *  (espeja el trigger del server); advierte al promover a superadmin. */
function CampoRol({
  rol,
  rolOriginal,
  motivo,
  onCambiar,
}: {
  rol: Rol;
  rolOriginal: Rol;
  motivo: string | null;
  onCambiar: (rol: Rol) => void;
}) {
  return (
    <>
      <Select
        label="Rol"
        value={rol}
        disabled={motivo !== null}
        title={motivo ?? undefined}
        hint={motivo ?? undefined}
        onChange={(evento) => onCambiar(evento.target.value as Rol)}
      >
        {ROLES.map(({ valor, etiqueta }) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>
      {rol === ROL.SUPERADMIN && rolOriginal !== ROL.SUPERADMIN && (
        <p className={styles.advertencia} role="status">
          {ADVERTENCIA_SUPERADMIN}
        </p>
      )}
    </>
  );
}

function enlaceAsignada(plantacion: PlantacionDeUsuario): EnlacePanel {
  return {
    clave: plantacion.id,
    ruta: `/plantaciones/${plantacion.id}`,
    texto: plantacion.nombre,
    detalle: ETIQUETA_ROL[plantacion.rolEnPlantacion],
  };
}

/** Las plantaciones de la persona, o por qué no hay lista. */
function ListaAsignadas({
  todas,
  asignadas,
}: {
  todas: boolean;
  asignadas: PlantacionDeUsuario[];
}) {
  if (todas) return <p className={styles.textoBloque}>{ACCESO_TOTAL}</p>;
  if (asignadas.length === 0) return <p className={styles.textoBloque}>{SIN_ASIGNACIONES}</p>;
  return <PanelListaEnlaces enlaces={asignadas.map(enlaceAsignada)} />;
}

/** A qué plantaciones accede la persona; los roles de gestión, a todas. */
function BloquePlantaciones({ usuario }: { usuario: UsuarioConAsignaciones }) {
  const todas = accedeATodas(usuario.rol);
  const plantaciones = useQuery({
    queryKey: CLAVE_QUERY.usuarioPlantaciones(usuario.id),
    queryFn: () => listarPlantacionesDeUsuario(usuario.id),
    enabled: !todas,
  });
  const asignadas = plantaciones.data ?? [];
  return (
    <PanelBloque titulo="Plantaciones asignadas" contador={todas ? undefined : asignadas.length}>
      <ListaAsignadas todas={todas} asignadas={asignadas} />
    </PanelBloque>
  );
}

/** Botón de acción rápida: deshabilitado con su motivo en el title, nunca oculto. */
function BotonAccion({ item, onAccion }: { item: ItemMenu; onAccion: () => void }) {
  const Icono = ICONO_ACCION[item.accion];
  return (
    <Button
      type="button"
      variant={item.destructiva ? 'destructiva' : 'contorno'}
      size="sm"
      disabled={item.motivo !== null}
      title={item.motivo ?? undefined}
      onClick={onAccion}
    >
      {Icono && <Icono size={TAMANO_ICONO.md} aria-hidden />}
      {item.etiqueta}
    </Button>
  );
}

/** Acciones que no pasan por el formulario: abren sus propios modales. */
function BloqueAcciones({
  items,
  onAccion,
}: {
  items: ItemMenu[];
  onAccion: (accion: AccionUsuario) => void;
}) {
  return (
    <PanelBloque titulo="Acciones">
      <div className={styles.acciones}>
        {items.map((item) => (
          <BotonAccion
            key={item.accion}
            item={item}
            onAccion={() => onAccion(item.accion)}
          />
        ))}
      </div>
      <p className={styles.ayuda}>{AYUDA_DESACTIVAR}</p>
    </PanelBloque>
  );
}

interface UsuarioPanelProps {
  usuario: UsuarioConAsignaciones;
  idActual: string | undefined;
  superadminsActivos: number;
  onAccion: (accion: AccionUsuario) => void;
  onCerrar: () => void;
}

/**
 * Panel lateral de una persona: edita nombre (directo a profiles), email (vía
 * edge function, que lo cambia en Auth y el trigger sincroniza profiles) y rol
 * (directo a profiles, con el trigger del server como guard final). Solo envía
 * lo que cambió.
 */
export function UsuarioPanel({
  usuario,
  idActual,
  superadminsActivos,
  onAccion,
  onCerrar,
}: UsuarioPanelProps) {
  const invalidarUsuarios = useInvalidarUsuarios();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [email, setEmail] = useState(usuario.email ?? '');
  const [rol, setRol] = useState<Rol>(usuario.rol);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const motivoRol = motivoCambiarRol(usuario, idActual, superadminsActivos);
  const nombreCambio = nombre.trim() !== usuario.nombre;
  const emailCambio = email.trim() !== (usuario.email ?? '');
  const rolCambio = motivoRol === null && rol !== usuario.rol;
  const valido =
    nombre.trim() !== '' &&
    (nombreCambio || emailCambio || rolCambio) &&
    (!emailCambio || emailValido(email.trim()));

  const mutacion = useMutation({
    // Los tres campos tocan backends independientes: en paralelo.
    mutationFn: async () => {
      await Promise.all([
        nombreCambio ? actualizarNombre(usuario.id, nombre.trim()) : null,
        emailCambio ? cambiarEmail(usuario.id, email.trim()) : null,
        rolCambio ? cambiarRol(usuario.id, rol) : null,
      ]);
    },
    // Siempre invalidar: si una parte cambió y otra falló (p.ej. nombre OK,
    // email duplicado), la lista igual debe reflejar lo que sí se guardó.
    onSettled: () => invalidarUsuarios(),
    onSuccess: onCerrar,
    onError: (error: Error) => setErrorEnvio(error.message),
  });

  return (
    <PanelLateral
      etiqueta={`Detalle de ${nombreVisible(usuario)}`}
      cabecera={<CabeceraUsuario usuario={usuario} />}
      onCerrar={onCerrar}
      pie={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-usuario"
            size="sm"
            disabled={!valido}
            loading={mutacion.isPending}
          >
            Guardar
          </Button>
        </>
      }
    >
      {/* El submit vive en el pie, fuera del form: los une el atributo form. */}
      <form
        id="form-usuario"
        className={styles.form}
        onSubmit={(evento) => {
          evento.preventDefault();
          mutacion.mutate();
        }}
      >
        <Input
          label="Nombre"
          required
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <CampoRol rol={rol} rolOriginal={usuario.rol} motivo={motivoRol} onCambiar={setRol} />
        {errorEnvio && (
          <p className={styles.errorEnvio} role="alert">
            {errorEnvio}
          </p>
        )}
      </form>
      <BloquePlantaciones usuario={usuario} />
      <BloqueAcciones
        items={itemsDeMenu(usuario, idActual, superadminsActivos)}
        onAccion={onAccion}
      />
    </PanelLateral>
  );
}
