/**
 * Desglose de pendientes de sync para la UI ("2 grupos, 1 parcela, 5 fotos").
 * Presentación pura y testeable; la consume SyncConfirmModal (issue #71: hace
 * diagnosticable un OrangeDot residual mostrando QUÉ queda pendiente).
 */

function cantidad(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export interface PendingBreakdownCounts {
  grupos: number;
  parcelas: number;
  fotos: number;
}

/** Devuelve null si no hay nada pendiente. */
export function formatPendingBreakdown(counts: PendingBreakdownCounts): string | null {
  const parts: string[] = [];
  if (counts.grupos > 0) parts.push(cantidad(counts.grupos, 'grupo', 'grupos'));
  if (counts.parcelas > 0) parts.push(cantidad(counts.parcelas, 'parcela', 'parcelas'));
  if (counts.fotos > 0) parts.push(cantidad(counts.fotos, 'foto', 'fotos'));
  return parts.length > 0 ? parts.join(', ') : null;
}
