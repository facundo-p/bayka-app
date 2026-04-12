import { useLiveData } from '../database/liveQuery';
import { db } from '../database/client';
import { trees, species } from '../database/schema';
import { eq, desc } from 'drizzle-orm';

export function useTrees(subgrupoId: string) {
  const { data } = useLiveData(
    () => db.select({
      id: trees.id,
      subgrupoId: trees.subgrupoId,
      especieId: trees.especieId,
      posicion: trees.posicion,
      subId: trees.subId,
      fotoUrl: trees.fotoUrl,
      fotoSynced: trees.fotoSynced,
      usuarioRegistro: trees.usuarioRegistro,
      createdAt: trees.createdAt,
      especieCodigo: species.codigo,
      especieNombre: species.nombre,
    })
      .from(trees)
      .leftJoin(species, eq(trees.especieId, species.id))
      .where(eq(trees.subgrupoId, subgrupoId))
      .orderBy(desc(trees.posicion)),
    [subgrupoId]
  );
  const allTrees = data ?? [];
  const lastThree = allTrees.slice(0, 3);
  const totalCount = allTrees.length;
  const unresolvedNN = allTrees.filter((t) => t.especieId === null).length;
  return { allTrees, lastThree, totalCount, unresolvedNN };
}
