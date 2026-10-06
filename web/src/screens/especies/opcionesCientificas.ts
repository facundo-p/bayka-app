/** Opciones del selector de especie científica del panel de una especie (#753). Puro. */
import type { OpcionConDetalle } from '../../components';
import type { EspecieCientificaConEspecies } from '../../queries/especieCientificaQueries';
import { SIN_ESPECIE_CIENTIFICA } from '../../services/especieValidaciones';

export const OPCION_SIN_ESPECIE_CIENTIFICA: OpcionConDetalle = {
  valor: SIN_ESPECIE_CIENTIFICA,
  principal: 'Sin especie científica',
};

/** Las otras especies que ya agrupa, para reconocerla; la que se edita no suma. */
function detalleAgrupadas(cientifica: EspecieCientificaConEspecies, especieId: string | null) {
  const otras = cientifica.especies.filter((especie) => especie.id !== especieId);
  return otras.length > 0 ? `Agrupa ${otras.map((especie) => especie.nombre).join(', ')}` : null;
}

export function opcionesDeEspecieCientifica(
  cientificas: EspecieCientificaConEspecies[],
  especieId: string | null,
): OpcionConDetalle[] {
  return [
    OPCION_SIN_ESPECIE_CIENTIFICA,
    ...cientificas.map((cientifica) => ({
      valor: cientifica.id,
      principal: cientifica.nombre,
      secundario: detalleAgrupadas(cientifica, especieId),
    })),
  ];
}
