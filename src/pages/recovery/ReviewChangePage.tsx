import { AppModal } from "../../components/AppModal";

type ReviewChangePageProps = { onApply: () => void; onKeep: () => void; onHome: () => void };

export function ReviewChangePage({ onApply, onKeep }: ReviewChangePageProps) {
  return <AppModal
    title="Move Bible study?"
    message="Wednesday 7:00 PM → Friday 7:00 PM"
    confirmLabel="Apply change"
    cancelLabel="Keep original"
    onConfirm={onApply}
    onClose={approved => { if (!approved) onKeep(); }}
  />;
}
