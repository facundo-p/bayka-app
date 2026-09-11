import { useQuery } from '@tanstack/react-query';
import { Ban, Key, Mail } from 'lucide-react';
import {
  Button,
  PanelBloque,
  PanelIdentidad,
  PanelLateral,
  PanelListaEnlaces,
  Select,
  type EnlacePanel,
} from '../../components';
import { formatearFechaDia } from '../../lib/fechas';
import { etiquetaRol, nombreVisible } from '../../lib/presentacionUsuario';
import { rutaPlantacion } from '../../lib/rutas';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  listarPlantacionesDeUsuario,
  type PlantacionDeUsuario,
  type UsuarioConAsignaciones,
} from '../../queries/usuarioQueries';
import { ROL, type Rol } from '../../repositories/profileRepository';
import {
  ACCION_USUARIO,
  itemsDeMenu,
  motivoCambiarRol,
  type AccionUsuario,
  type ItemMenu,
} from './acciones';
import { Avatar } from './celdas';
import { AvisoSuperadmin, CamposContacto, ErrorEnvio } from './formulario';
import { OPCIONES_ROL } from './presentacion';
import { useEdicionUsuario, type EdicionUsuario } from './useEdicionUsuario';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './Usuarios.module.css';

const AYUDA_DESACTIVAR =
  'Al desactivar pierde el acceso; sus datos de campo se conservan y se puede reactivar.';
const SIN_ASIGNACIONES = 'Sin plantaciones asignadas';
const ACCESO_TOTAL = 'Acceso a todas las plantaciones';
/** El submit vive en el pie, fuera del form: los une el atributo form. */
const ID_FORM_USUARIO = 'form-usuario';

/** Ícono de cada acción rápida del panel (las mismas que el menú "⋯"). */
const ICONO_ACCION: Record<AccionUsuario, typeof Key> = {
  [ACCION_USUARIO.cambiarPassword]: Key,
  [ACCION_USUARIO.reenviarInvitacion]: Mail,
  [ACCION_USUARIO.desactivar]: Ban,
  [ACCION_USUARIO.reactivar]: Ban,
};

/** Superadmin y admin son miembros automáticos de todas las plantaciones (#67). */
function accedeATodas(rol: Rol): boolean {
  return rol === ROL.SUPERADMIN || rol === ROL.ADMIN;
}

function CabeceraUsuario({ usuario }: { usuario: UsuarioConAsignaciones }) {
  return (
    <PanelIdentidad
      marca={<Avatar usuario={usuario} clase={styles.avatarGrande} />}
      titulo={nombreVisible(usuario.nombre, usuario.id)}
      meta={
        <>
          {etiquetaRol(usuario.rol)} · desde {formatearFechaDia(usuario.createdAt)}
        </>
      }
    />
  );
}

interface CampoRolProps {
  rol: Rol;
  rolOriginal: Rol;
  motivo: string | null;
  onCambiar: (rol: Rol) => void;
}

/** Campo de rol: deshabilitado con el motivo visible cuando el guard aplica
 *  (espeja el trigger del server); advierte al promover a superadmin. */
function CampoRol({ rol, rolOriginal, motivo, onCambiar }: CampoRolProps) {
  return (
    <>
      <Select
        label="Rol"
        value={rol}
        disabled={motivo !== null}
        title={motivo ?? undefined}
        hint={motivo ?? undefined}
        onChange={(evento) => onCambiar(evento.target.value as Rol)}
        opciones={OPCIONES_ROL}
      />
      {rol === ROL.SUPERADMIN && rolOriginal !== ROL.SUPERADMIN && (
        <AvisoSuperadmin className={styles.advertencia} />
      )}
    </>
  );
}

interface FormularioUsuarioProps {
  edicion: EdicionUsuario;
  rolOriginal: Rol;
  motivoRol: string | null;
}

function FormularioUsuario({ edicion, rolOriginal, motivoRol }: FormularioUsuarioProps) {
  return (
    <form id={ID_FORM_USUARIO} className={styles.form} onSubmit={edicion.enviar}>
      <CamposContacto campos={edicion} />
      <CampoRol
        rol={edicion.valores.rol}
        rolOriginal={rolOriginal}
        motivo={motivoRol}
        onCambiar={(rol) => edicion.cambiar('rol', rol)}
      />
      <ErrorEnvio mensaje={edicion.errorEnvio} className={styles.errorEnvio} />
    </form>
  );
}

/** Guardar se habilita con algún cambio válido. */
function PieEdicion({ edicion, onCancelar }: { edicion: EdicionUsuario; onCancelar: () => void }) {
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={onCancelar}>
        Cancelar
      </Button>
      <Button
        type="submit"
        form={ID_FORM_USUARIO}
        size="sm"
        disabled={!edicion.valido}
        loading={edicion.guardando}
      >
        Guardar
      </Button>
    </>
  );
}

function enlaceAsignada(plantacion: PlantacionDeUsuario): EnlacePanel {
  return {
    clave: plantacion.id,
    ruta: rutaPlantacion(plantacion.id),
    texto: plantacion.nombre,
    detalle: etiquetaRol(plantacion.rolEnPlantacion),
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
      <Icono size={TAMANO_ICONO.md} aria-hidden />
      {item.etiqueta}
    </Button>
  );
}

type BloqueAccionesProps = Omit<UsuarioPanelProps, 'onCerrar'>;

/** Acciones que no pasan por el formulario: abren sus propios modales. */
function BloqueAcciones({ usuario, idActual, superadminsActivos, onAccion }: BloqueAccionesProps) {
  return (
    <PanelBloque titulo="Acciones">
      <div className={styles.acciones}>
        {itemsDeMenu(usuario, idActual, superadminsActivos).map((item) => (
          <BotonAccion key={item.accion} item={item} onAccion={() => onAccion(item.accion)} />
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
 * Panel lateral de una persona: edita nombre, email y rol (el trigger del
 * server es el guard final del rol) y ofrece las acciones rápidas.
 */
export function UsuarioPanel(props: UsuarioPanelProps) {
  const { usuario, onCerrar } = props;
  const motivoRol = motivoCambiarRol(usuario, props.idActual, props.superadminsActivos);
  const edicion = useEdicionUsuario(usuario, motivoRol === null, onCerrar);
  return (
    <PanelLateral
      etiqueta={`Detalle de ${nombreVisible(usuario.nombre, usuario.id)}`}
      cabecera={<CabeceraUsuario usuario={usuario} />}
      onCerrar={onCerrar}
      pie={<PieEdicion edicion={edicion} onCancelar={onCerrar} />}
    >
      <FormularioUsuario edicion={edicion} rolOriginal={usuario.rol} motivoRol={motivoRol} />
      <BloquePlantaciones usuario={usuario} />
      <BloqueAcciones {...props} />
    </PanelLateral>
  );
}
