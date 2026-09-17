import { Badge, type TableColumn } from '../../components';
import { formatearFechaDia } from '../../lib/fechas';
import { etiquetaRol } from '../../lib/presentacionUsuario';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { esEliminado } from '../../repositories/profileRepository';
import type { AccionActiva, ContextoAcciones } from './acciones';
import { CeldaAcciones, CeldaTexto, CeldaUsuario } from './celdas';
import { resumenPlantaciones } from './filtros';
import styles from './Usuarios.module.css';

const ETIQUETA_ESTADO = { activo: 'Activo', inactivo: 'Inactivo', eliminado: 'Eliminado' } as const;

function etiquetaEstado(usuario: UsuarioConAsignaciones): string {
  if (esEliminado(usuario)) return ETIQUETA_ESTADO.eliminado;
  return usuario.activo ? ETIQUETA_ESTADO.activo : ETIQUETA_ESTADO.inactivo;
}

const COLUMNAS_BASE: Array<TableColumn<UsuarioConAsignaciones>> = [
  { key: 'usuario', header: 'Usuario', render: (usuario) => <CeldaUsuario usuario={usuario} /> },
  {
    key: 'rol',
    header: 'Rol',
    render: (usuario) => <Badge variant={usuario.rol}>{etiquetaRol(usuario.rol)}</Badge>,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (usuario) => (
      <Badge variant={usuario.activo ? 'activa' : 'neutral'} dot>
        {etiquetaEstado(usuario)}
      </Badge>
    ),
  },
  {
    key: 'plantaciones',
    fueraEnMovil: true,
    header: 'Plantaciones',
    render: (usuario) => <CeldaTexto usuario={usuario} texto={resumenPlantaciones(usuario)} />,
  },
  {
    key: 'alta',
    fueraEnMovil: true,
    header: 'Alta',
    render: (usuario) => (
      <CeldaTexto
        usuario={usuario}
        clase={styles.alta}
        texto={formatearFechaDia(usuario.createdAt)}
      />
    ),
  },
];

/** Columnas del listado + el menú "⋯" de acciones rápidas por fila. */
export function columnasUsuarios(
  onAccion: (activa: AccionActiva) => void,
  contexto: ContextoAcciones,
): Array<TableColumn<UsuarioConAsignaciones>> {
  const acciones: TableColumn<UsuarioConAsignaciones> = {
    key: 'acciones',
    header: '',
    align: 'right',
    render: (usuario) => (
      <CeldaAcciones usuario={usuario} contexto={contexto} onAccion={onAccion} />
    ),
  };
  return [...COLUMNAS_BASE, acciones];
}
