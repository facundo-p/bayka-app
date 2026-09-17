/**
 * PhotoCropProvider — flujo de captura de foto en un solo paso (#167/#172).
 * requestPhoto(source) resuelve con la URI final (recortada o no) o null si se cancela.
 */
import { createContext, useContext, useState } from 'react';
import CameraCaptureView from './CameraCaptureView';
import PhotoCropModal from './PhotoCropModal';
import { launchGalleryRaw, type RawPhoto } from '../services/PhotoService';

export type PhotoSource = 'camera' | 'gallery';

interface PhotoCropContextValue {
  requestPhoto: (source: PhotoSource) => Promise<string | null>;
}

const PhotoCropContext = createContext<PhotoCropContextValue | null>(null);

type Resolve = (value: string | null) => void;
type Flow =
  | { stage: 'camera'; resolve: Resolve }
  | { stage: 'crop'; raw: RawPhoto; source: PhotoSource; resolve: Resolve }
  | null;

export function PhotoCropProvider({ children }: { children: React.ReactNode }) {
  const [flow, setFlow] = useState<Flow>(null);

  function requestPhoto(source: PhotoSource): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      if (source === 'camera') {
        setFlow({ stage: 'camera', resolve });
      } else {
        launchGalleryRaw().then((raw) => {
          if (raw) setFlow({ stage: 'crop', raw, source: 'gallery', resolve });
          else resolve(null);
        });
      }
    });
  }

  function finish(value: string | null) {
    flow?.resolve(value);
    setFlow(null);
  }

  function retry() {
    if (!flow || flow.stage !== 'crop') return;
    const { resolve, source } = flow;
    if (source === 'camera') {
      setFlow({ stage: 'camera', resolve });
    } else {
      launchGalleryRaw().then((raw) => {
        if (raw) setFlow({ stage: 'crop', raw, source: 'gallery', resolve });
        // Si cancela la galería, se mantiene el recorte actual.
      });
    }
  }

  return (
    <PhotoCropContext.Provider value={{ requestPhoto }}>
      {children}
      <CameraCaptureView
        visible={flow?.stage === 'camera'}
        onCapture={(raw) =>
          setFlow((f) => (f && f.stage === 'camera' ? { stage: 'crop', raw, source: 'camera', resolve: f.resolve } : f))
        }
        onCancel={() => finish(null)}
      />
      <PhotoCropModal
        raw={flow?.stage === 'crop' ? flow.raw : null}
        onCancel={() => finish(null)}
        onSave={(uri) => finish(uri)}
        onRetry={flow?.stage === 'crop' ? retry : undefined}
      />
    </PhotoCropContext.Provider>
  );
}

export function usePhotoCaptureFlow(): PhotoCropContextValue {
  const ctx = useContext(PhotoCropContext);
  if (!ctx) throw new Error('usePhotoCaptureFlow debe usarse dentro de PhotoCropProvider');
  return ctx;
}
