import StatusChip from './StatusChip';

export default function GroupStateChip({ estado }: { estado: string }) {
  return <StatusChip estado={estado} size="sm" />;
}
