import { Badge, type TableColumn } from '../../components';
import { formatearFechaDia } from '../../lib/fechas';
import type { UsuarioConAsignaciones } from '../../queries/usuarioQueries';
import { itemsDeMenu, type AccionUsuario } from './acciones';
import { CeldaTexto, CeldaUsuario } from './celdas';
import { resumenPlantaciones } from './filtros';
import { MenuAccionesUsuario } from './MenuAccionesUsuario';
import { ETIQUETA_ROL, nombreVisible } from './presentacion';
import styles from './Usuarios.module.css';

const ETIQUETA_ESTADO = { activo: 'Activo', inactivo: 'Inactivo' } as const;

const COLUMNAS_BASE: Array<TableColumn<UsuarioConAsignaciones>> = [
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
  onAccion: (usuario: UsuarioConAsignaciones, accion: AccionUsuario) => void,
  idActual: string | undefined,
  superadminsActivos: number,
): Array<TableColumn<UsuarioConAsignaciones>> {
  return [
    ...COLUMNAS_BASE,
    {
      key: 'acciones',
      header: '',
      align: 'right',
      render: (usuario) => (
        // La fila abre el panel: el menú frena el click para no hacer las dos cosas.
        <span onClick={(evento) => evento.stopPropagation()}>
          <MenuAccionesUsuario
            nombre={nombreVisible(usuario)}
            items={itemsDeMenu(usuario, idActual, superadminsActivos)}
            onAccion={(accion) => onAccion(usuario, accion)}
          />
        </span>
      ),
    },
  ];
}
