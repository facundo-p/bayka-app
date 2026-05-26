import StatusChip from './StatusChip';

export default function SubGroupStateChip({ estado }: { estado: string }) {
  return <StatusChip estado={estado} size="sm" />;
}
