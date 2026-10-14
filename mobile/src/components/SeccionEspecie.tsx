/**
 * Especie en el detalle del árbol: nombre, ID y, si se puede, «Cambiar especie»
 * (#679). En un grupo finalizado el botón se ve grisado y ofrece reabrirlo y
 * cambiar en un solo paso.
 */
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import type { TreeDetail } from '../hooks/useTreeDetail';
import { useCambioDeEspecie, type CambioDeEspecieDelArbol } from '../hooks/useCambioDeEspecie';
import { getSpeciesName } from '../utils/speciesHelpers';
import { idDeArbol } from '../../../shared/codigoPlantacion';
import { showConfirmDialog, type ShowFn } from '../utils/alertHelpers';
import {
  cambioRequiereReabrir,
  seOfreceCambioDeEspecie,
  type CambioDeEspecie,
} from '../utils/permisosDeEdicion';
import SelectorDeEspecie from './SelectorDeEspecie';
import { treeDetailModalStyles as modalStyles } from './TreeDetailModal.styles';
import { seccionEspecieStyles as styles } from './SeccionEspecie.styles';

export const ETIQUETA_CAMBIAR_ESPECIE = 'Cambiar especie';

export const AVISO_REABRIR_GRUPO = {
  titulo: 'Grupo finalizado',
  mensaje: 'Para cambiar la especie hay que reabrir el grupo primero. Después podés volver a finalizarlo.',
  confirmar: 'Reabrir y cambiar',
} as const;

interface Props {
  tree: TreeDetail;
  plantacionId: string;
  cambio: CambioDeEspecie;
  /** true si el grupo quedó activo. */
  onReabrirGrupo: () => Promise<boolean>;
  confirmar: ShowFn;
}

type Accion = () => void;

/** Con el grupo finalizado, el buscador se abre recién cuando el usuario lo reabre. */
function abrirAlReabrir(abrir: Accion, onReabrirGrupo: Props['onReabrirGrupo'], confirmar: ShowFn): Accion {
  return () => showConfirmDialog(confirmar, AVISO_REABRIR_GRUPO.titulo, AVISO_REABRIR_GRUPO.mensaje,
    AVISO_REABRIR_GRUPO.confirmar, async () => {
      if (await onReabrirGrupo()) abrir();
    }, { icon: 'lock-open-outline' });
}

function BotonCambiar({ grisado, guardando, onPress }: { grisado: boolean; guardando: boolean; onPress: Accion }) {
  const color = grisado ? colors.textDisabled : colors.plantation;
  return (
    <Pressable
      style={[styles.boton, grisado && styles.botonGrisado]}
      // Sin `disabled`: Pressable pisaría el estado accesible, y grisado igual responde.
      onPress={guardando ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: grisado || guardando }}
    >
      {guardando ? (
        <ActivityIndicator size="small" color={colors.plantation} />
      ) : (
        <>
          <Ionicons name="leaf-outline" size={iconSizes.action} color={color} />
          <Text style={[styles.botonTexto, grisado && styles.botonTextoGrisado]}>{ETIQUETA_CAMBIAR_ESPECIE}</Text>
        </>
      )}
    </Pressable>
  );
}

function DatosDeEspecie({ tree }: { tree: TreeDetail }) {
  return (
    <>
      <Text style={modalStyles.sectionLabel}>Especie</Text>
      <Text style={[modalStyles.speciesName, tree.especieId === null && modalStyles.speciesNN]}>
        {getSpeciesName(tree)}
      </Text>
      {tree.especieNombreCientifico ? (
        <Text style={modalStyles.scientific}>{tree.especieNombreCientifico}</Text>
      ) : null}
      <Text style={modalStyles.subId}>{idDeArbol(tree.subId, tree.plantacionCodigo)}</Text>
    </>
  );
}

function EdicionDeEspecie({ tree, cambio, requiereReabrir, onCambiar }: {
  tree: TreeDetail;
  cambio: CambioDeEspecieDelArbol;
  requiereReabrir: boolean;
  onCambiar: Accion;
}) {
  if (cambio.abierto) {
    return (
      <SelectorDeEspecie
        especies={cambio.especies}
        especieActualId={tree.especieId}
        busqueda={cambio.busqueda}
        onBuscar={cambio.setBusqueda}
        onElegir={cambio.elegir}
        onCancelar={cambio.cerrar}
      />
    );
  }
  return <BotonCambiar grisado={requiereReabrir} guardando={cambio.guardando} onPress={onCambiar} />;
}

export default function SeccionEspecie({ tree, plantacionId, cambio: permiso, onReabrirGrupo, confirmar }: Props) {
  const cambio = useCambioDeEspecie(tree, plantacionId);
  const ofrecido = seOfreceCambioDeEspecie(permiso);
  const requiereReabrir = cambioRequiereReabrir(permiso);
  const onCambiar = requiereReabrir ? abrirAlReabrir(cambio.abrir, onReabrirGrupo, confirmar) : cambio.abrir;

  return (
    <View style={modalStyles.section}>
      <DatosDeEspecie tree={tree} />
      {ofrecido && (
        <EdicionDeEspecie tree={tree} cambio={cambio} requiereReabrir={requiereReabrir} onCambiar={onCambiar} />
      )}
    </View>
  );
}
