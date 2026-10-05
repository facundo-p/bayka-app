/**
 * PhotoCropProvider — flujo de captura de foto en un solo paso (#167/#172).
 * pickPhoto abre la cámara directo, con la galería adentro (#749), y resuelve
 * con la URI final (recortada o no) o null si no hubo foto.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import CameraCaptureView from './CameraCaptureView';
import PhotoCropModal from './PhotoCropModal';
import { launchGalleryRaw, type RawPhoto } from '../services/PhotoService';
import type { PickPhoto } from '../services/photo/photoCaptureRules';

/** gallery: la cámara ya se cerró y el picker del sistema está abierto. */
const PHOTO_FLOW_STAGE = {
  camera: 'camera',
  gallery: 'gallery',
  crop: 'crop',
} as const;

interface PhotoCropContextValue {
  pickPhoto: PickPhoto;
}

const PhotoCropContext = createContext<PhotoCropContextValue | null>(null);

type Resolve = (value: string | null) => void;
type Flow =
  | { stage: typeof PHOTO_FLOW_STAGE.camera; resolve: Resolve }
  | { stage: typeof PHOTO_FLOW_STAGE.gallery; resolve: Resolve }
  | { stage: typeof PHOTO_FLOW_STAGE.crop; raw: RawPhoto; resolve: Resolve };

type FlowAt<S extends Flow['stage']> = Extract<Flow, { stage: S }>;
type SetFlow = React.Dispatch<React.SetStateAction<Flow | null>>;

function isStage<S extends Flow['stage']>(flow: Flow | null, stage: S): flow is FlowAt<S> {
  return flow?.stage === stage;
}

/** Galería elegida → recorte; cancelada (o con error) → vuelve a la cámara, con la misma Promise. */
function useGalleryStage(flow: Flow | null, setFlow: SetFlow) {
  const inGallery = isStage(flow, PHOTO_FLOW_STAGE.gallery);
  useEffect(() => {
    if (!inGallery) return;
    void launchGalleryRaw()
      .catch(() => null)
      .then((raw) => {
        setFlow((f) => {
          if (!isStage(f, PHOTO_FLOW_STAGE.gallery)) return f;
          return raw
            ? { stage: PHOTO_FLOW_STAGE.crop, raw, resolve: f.resolve }
            : { stage: PHOTO_FLOW_STAGE.camera, resolve: f.resolve };
        });
      });
  }, [inGallery, setFlow]);
}

export function PhotoCropProvider({ children }: { children: React.ReactNode }) {
  const [flow, setFlow] = useState<Flow | null>(null);
  // Fuera de flow: mantiene el texto mientras el Modal de la cámara se anima al cerrarse.
  const [optional, setOptional] = useState(false);
  useGalleryStage(flow, setFlow);

  const pickPhoto = useCallback<PickPhoto>((options) => new Promise((resolve) => {
    setOptional(options?.optional ?? false);
    setFlow({ stage: PHOTO_FLOW_STAGE.camera, resolve });
  }), []);
  const value = useMemo(() => ({ pickPhoto }), [pickPhoto]);

  function finish(result: string | null) {
    flow?.resolve(result);
    setFlow(null);
  }

  function fromCamera(next: (f: FlowAt<typeof PHOTO_FLOW_STAGE.camera>) => Flow) {
    setFlow((f) => (isStage(f, PHOTO_FLOW_STAGE.camera) ? next(f) : f));
  }

  // Reintentar vuelve siempre a la cámara, que ya ofrece la galería.
  function retry() {
    setFlow((f) => (isStage(f, PHOTO_FLOW_STAGE.crop) ? { stage: PHOTO_FLOW_STAGE.camera, resolve: f.resolve } : f));
  }

  return (
    <PhotoCropContext.Provider value={value}>
      {children}
      <CameraCaptureView
        visible={isStage(flow, PHOTO_FLOW_STAGE.camera)}
        optional={optional}
        onCapture={(raw) => fromCamera((f) => ({ stage: PHOTO_FLOW_STAGE.crop, raw, resolve: f.resolve }))}
        onGallery={() => fromCamera((f) => ({ stage: PHOTO_FLOW_STAGE.gallery, resolve: f.resolve }))}
        onCancel={() => finish(null)}
      />
      <PhotoCropModal
        raw={isStage(flow, PHOTO_FLOW_STAGE.crop) ? flow.raw : null}
        onCancel={() => finish(null)}
        onSave={(uri) => finish(uri)}
        onRetry={isStage(flow, PHOTO_FLOW_STAGE.crop) ? retry : undefined}
      />
    </PhotoCropContext.Provider>
  );
}

export function usePhotoCaptureFlow(): PhotoCropContextValue {
  const ctx = useContext(PhotoCropContext);
  if (!ctx) throw new Error('usePhotoCaptureFlow debe usarse dentro de PhotoCropProvider');
  return ctx;
}
