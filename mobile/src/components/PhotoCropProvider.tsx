/**
 * PhotoCropProvider — hospeda el paso de recorte (#167) a nivel app.
 * Expone `requestCrop(raw)` que muestra el PhotoCropModal y resuelve con la URI
 * final (recortada o completa) o null si se cancela. Así cualquier captura de
 * foto inserta el recorte en un solo paso, sin acoplar el modal a cada pantalla.
 */
import { createContext, useCallback, useContext, useState } from 'react';
import PhotoCropModal from './PhotoCropModal';
import type { RawPhoto } from '../services/PhotoService';

interface PhotoCropContextValue {
  requestCrop: (raw: RawPhoto) => Promise<string | null>;
}

const PhotoCropContext = createContext<PhotoCropContextValue | null>(null);

export function PhotoCropProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{ raw: RawPhoto; resolve: (v: string | null) => void } | null>(null);

  const requestCrop = useCallback(
    (raw: RawPhoto) => new Promise<string | null>((resolve) => setPending({ raw, resolve })),
    [],
  );

  function finish(value: string | null) {
    pending?.resolve(value);
    setPending(null);
  }

  return (
    <PhotoCropContext.Provider value={{ requestCrop }}>
      {children}
      <PhotoCropModal
        raw={pending?.raw ?? null}
        onCancel={() => finish(null)}
        onSave={(uri) => finish(uri)}
      />
    </PhotoCropContext.Provider>
  );
}

export function usePhotoCrop(): PhotoCropContextValue {
  const ctx = useContext(PhotoCropContext);
  if (!ctx) throw new Error('usePhotoCrop debe usarse dentro de PhotoCropProvider');
  return ctx;
}
