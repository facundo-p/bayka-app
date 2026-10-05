import PhotoViewer from './PhotoViewer';

/**
 * `reemplazoConfirmado`: se abrió desde «Ver actual» de un aviso de reemplazo (el botón de la
 * botonera, #751); Reemplazar no vuelve a preguntar.
 */
export type FotoDeArbol = { uri: string; treeId: string; reemplazoConfirmado?: boolean };

interface Props {
  foto: FotoDeArbol | null;
  /** Sin permiso (grupo ajeno, plantación no editable) solo se ve la foto (#745). */
  canEdit: boolean;
  onClose: () => void;
  onReplace: (foto: FotoDeArbol) => void;
  onRemove: (treeId: string) => void;
}

/** Visor de la foto de un árbol del grupo, con las acciones de edición según permiso. */
export default function TreePhotoViewer({ foto, canEdit, onClose, onReplace, onRemove }: Props) {
  const editable = canEdit ? foto : null;
  return (
    <PhotoViewer
      uri={foto?.uri ?? null}
      treeId={foto?.treeId}
      onClose={onClose}
      onReplace={editable ? () => onReplace(editable) : undefined}
      onRemove={editable ? () => onRemove(editable.treeId) : undefined}
    />
  );
}
