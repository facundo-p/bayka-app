import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useTreeRegistrationScreen } from '../hooks/useTreeRegistrationScreen';
import TreeRegistrationHeader from '../components/TreeRegistrationHeader';
import ViewAllTreesRow from '../components/ViewAllTreesRow';
import TreeStrip from '../components/TreeStrip';
import TreeGpsRow from '../components/TreeGpsRow';
import BotoneraDeEspecies from '../components/BotoneraDeEspecies';
import TreeActionBar from '../components/TreeActionBar';
import ReadOnlyTreeView from '../components/ReadOnlyTreeView';
import TreeListModal from '../components/TreeListModal';
import TreeDetailModal from '../components/TreeDetailModal';
import TreePhotoViewer from '../components/TreePhotoViewer';
import TreeConfigModal from '../components/TreeConfigModal';
import SpeciesReorderModal from '../components/SpeciesReorderModal';
import ConfirmModal from '../components/ConfirmModal';
import ScreenContainer from '../components/ScreenContainer';
import ConflictosDelGrupoAviso from '../components/ConflictosDelGrupoAviso';
import { useConflictosDeGrupo } from '../hooks/useConflictosDeGrupo';
import { colors } from '../theme';
import { GROUP_TIPO_LABELS, type GroupTipo } from '../constants/groupTipo';
import { treeRegistrationScreenStyles as styles } from './TreeRegistrationScreen.styles';

export default function TreeRegistrationScreen() {
  const { id: grupoId, plantacionId, grupoCodigo, grupoNombre } = useLocalSearchParams<{
    id: string; plantacionId: string; grupoCodigo: string; grupoNombre: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const {
    userId, confirm, treeReg, gpsWatcher, gpsGate, speciesOrder, botonera, treeSelection,
    visor, fotoDelSeleccionado, accionesDeGrupo, accionesDeArbol, permisos,
  } = useTreeRegistrationScreen({ grupoId, plantacionId, grupoCodigo });
  const { selectedTree } = treeSelection;
  const conflictos = useConflictosDeGrupo(grupoId ?? '', plantacionId ?? '');

  const [showTreeList, setShowTreeList] = useState(false);
  const [editingTreeId, setEditingTreeId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const { dataLoaded, isReadOnly, canReactivate, totalCount, unresolvedNN,
    sortedTrees, finalizing, deleting, deletingTreeId } = treeReg;

  return (
    <ScreenContainer withTexture>
      <TreeRegistrationHeader
        title={grupoNombre ?? grupoCodigo ?? ''}
        subtitle={treeReg.subgroup
          ? `${treeReg.subgroup.codigo} · ${GROUP_TIPO_LABELS[treeReg.subgroup.tipo as GroupTipo]}`
          : undefined}
        treeCount={totalCount}
        unresolvedNN={unresolvedNN}
        onBack={() => router.back()}
      />

      {conflictos.aviso && <ConflictosDelGrupoAviso texto={conflictos.aviso} onResolver={conflictos.resolver} />}

      {dataLoaded && !isReadOnly && (
        <ViewAllTreesRow totalCount={totalCount} onPress={() => setShowTreeList(true)} />
      )}

      {dataLoaded && !isReadOnly && (
        <TreeStrip
          trees={sortedTrees}
          selectedId={selectedTree?.id ?? null}
          onSelect={treeSelection.select}
          onDelete={accionesDeArbol.handleDeleteSelected}
          footer={
            <TreeGpsRow
              signal={gpsWatcher}
              tree={selectedTree && {
                hasPoint: selectedTree.latitude != null,
                gpsAccuracy: selectedTree.gpsAccuracy ?? null,
              }}
              capturing={selectedTree !== null && treeReg.gpsCapturingTreeId === selectedTree.id}
              disabled={treeReg.gpsCapturingTreeId !== null}
              onCapture={accionesDeArbol.handleCaptureGps}
            />
          }
        />
      )}

      {!dataLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.plantation} />
        </View>
      ) : !isReadOnly ? (
        <>
          <BotoneraDeEspecies
            gpsGate={gpsGate}
            loading={speciesOrder.loading}
            species={speciesOrder.orderedSpecies}
            estilo={botonera.estilo}
            disabled={isReadOnly}
            onSelectSpecies={({ especieId, especieCodigo }) => treeReg.registerTree(especieId, especieCodigo)}
            onNNPress={() => treeReg.registerNN()}
          />
          <TreeActionBar
            deleting={deleting}
            finalizing={finalizing}
            foto={fotoDelSeleccionado}
            seleccionadoSubId={selectedTree?.subId ?? null}
            onDeleteGroup={accionesDeGrupo.handleDeleteGroup}
            onOpenConfig={() => setShowConfigModal(true)}
            onFinalizar={accionesDeGrupo.handleFinalizar}
          />
        </>
      ) : (
        <ReadOnlyTreeView
          trees={sortedTrees}
          canReactivate={canReactivate}
          arbolesConCambios={conflictos.arbolesConCambios}
          onReactivate={accionesDeGrupo.handleReactivate}
          onViewPhoto={(treeId, uri) => visor.abrir({ uri, treeId })}
          onSelectTree={setEditingTreeId}
        />
      )}

      <TreeListModal
        visible={showTreeList}
        trees={sortedTrees}
        isReadOnly={isReadOnly}
        arbolesConCambios={conflictos.arbolesConCambios}
        deletingTreeId={deletingTreeId}
        onClose={() => setShowTreeList(false)}
        onViewPhoto={(treeId, uri) => visor.abrir({ uri, treeId })}
        onAttachPhoto={(treeId) => treeReg.addPhotoToTree(treeId)}
        onDeleteTree={accionesDeArbol.handleDeleteTree}
        onSelectTree={(treeId) => { setShowTreeList(false); setEditingTreeId(treeId); }}
      />

      <TreeDetailModal
        visible={editingTreeId !== null}
        treeId={editingTreeId}
        plantacionId={plantacionId ?? ''}
        canEdit={permisos.canEdit}
        canDelete={permisos.canDelete}
        cambioDeEspecie={permisos.cambioDeEspecie}
        onClose={() => setEditingTreeId(null)}
        onReabrirGrupo={treeReg.executeReactivate}
        onCapturePhoto={treeReg.addPhotoToTree}
        onRemovePhoto={treeReg.removePhoto}
        onCaptureGps={(treeId) => treeReg.captureTreeGps(treeId)}
        onDelete={(treeId, posicion) => {
          setEditingTreeId(null);
          accionesDeArbol.handleDeleteTree(treeId, posicion);
        }}
      />

      <TreePhotoViewer
        foto={visor.foto}
        canEdit={permisos.canEdit}
        onClose={visor.cerrar}
        onReplace={visor.handleReplacePhoto}
        onRemove={visor.handleRemovePhoto}
      />

      <ConfirmModal {...confirm.confirmProps} />

      <TreeConfigModal
        visible={showConfigModal}
        isReadOnly={isReadOnly}
        onClose={() => setShowConfigModal(false)}
        onReverseOrder={() => {
          setShowConfigModal(false);
          accionesDeGrupo.handleReverseOrder();
        }}
        onReorderSpecies={() => {
          setShowConfigModal(false);
          speciesOrder.initReorderFromCurrent();
          setShowReorderModal(true);
        }}
        estiloBotonera={botonera.estilo}
        especies={speciesOrder.orderedSpecies}
        onCambiarEstiloBotonera={botonera.setEstilo}
      />

      <SpeciesReorderModal
        visible={showReorderModal}
        items={speciesOrder.reorderItems}
        onReorder={speciesOrder.setReorderItems}
        onCancel={() => setShowReorderModal(false)}
        onSave={async () => {
          await speciesOrder.saveReorder(userId, plantacionId ?? '');
          setShowReorderModal(false);
        }}
      />
    </ScreenContainer>
  );
}
