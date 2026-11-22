import { useEffect, useRef } from "react";
import "./AppModal.css";

export type AppModalContent = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
};

type Props = AppModalContent & { onClose: (approved: boolean) => void };

export function AppModal({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const completed = useRef(false);
  const dismiss = (approved: boolean) => {
    if (completed.current) return;
    completed.current = true;
    onClose(approved);
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return <dialog ref={dialogRef} className="near-app-modal" aria-labelledby="near-app-modal-title" onClose={() => dismiss(false)}>
    <h2 id="near-app-modal-title">{title}</h2>
    <p>{message}</p>
    <div className="near-app-modal-actions">
      {onConfirm && <button type="button" onClick={() => dismiss(false)}>{cancelLabel ?? "Cancel"}</button>}
      <button type="button" className={danger ? "is-danger" : "is-primary"} onClick={() => {
        if (completed.current) return;
        dismiss(Boolean(onConfirm));
        onConfirm?.();
      }}>{confirmLabel ?? "OK"}</button>
    </div>
  </dialog>;
}
