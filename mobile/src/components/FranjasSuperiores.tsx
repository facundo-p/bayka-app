/**
 * Las franjas que van arriba de todo, entre la status bar y el header: "entorno de
 * pruebas" (#287) y el aviso de OTA listo (#446).
 *
 * Además de renderizarlas decide quién se come el inset superior y lo publica por
 * contexto, porque `CustomHeader` tiene que dejar de aplicarlo en el mismo render
 * en que aparece el aviso. Con una store y un efecto habría un frame con el header
 * corrido; acá los dos leen el mismo valor en la misma pasada.
 *
 * `children` es el navigator: al ser la misma prop entre renders, prender o apagar
 * el aviso no re-renderiza la app, solo a quienes consumen el contexto.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useUpdates } from 'expo-updates';

import BannerActualizacionLista from './BannerActualizacionLista';
import BannerEntornoPruebas from './BannerEntornoPruebas';
import { InsetSuperiorContexto } from './insetSuperior';

export default function FranjasSuperiores({ children }: { children: ReactNode }) {
  const { isUpdatePending } = useUpdates();
  const [descartado, setDescartado] = useState(false);
  const hayAvisoDeActualizacion = Boolean(isUpdatePending) && !descartado;
  const contexto = useMemo(() => ({ hayAvisoDeActualizacion }), [hayAvisoDeActualizacion]);

  return (
    <InsetSuperiorContexto.Provider value={contexto}>
      <BannerEntornoPruebas />
      {hayAvisoDeActualizacion && <BannerActualizacionLista onDescartar={() => setDescartado(true)} />}
      {children}
    </InsetSuperiorContexto.Provider>
  );
}
