import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, CircleAlert } from 'lucide-react';
import { dismiss, useToasts } from '../lib/toast';
import type { BudgetStatus } from '../lib/kakeibo';

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not(.icon-btn)');
    first?.focus();
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// --- Boîte de confirmation (remplace window.confirm) -------------------------
interface AskOptions {
  title: string;
  text?: string;
  confirm?: string;
  danger?: boolean;
}
let pending: (AskOptions & { resolve: (ok: boolean) => void }) | null = null;
const askListeners = new Set<() => void>();

export function ask(opts: AskOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...opts, resolve };
    askListeners.forEach((l) => l());
  });
}

export function ConfirmHost() {
  const current = useSyncExternalStore(
    (l) => {
      askListeners.add(l);
      return () => askListeners.delete(l);
    },
    () => pending,
  );
  if (!current) return null;
  const close = (ok: boolean) => {
    current.resolve(ok);
    pending = null;
    askListeners.forEach((l) => l());
  };
  return (
    <Modal
      title={current.title}
      onClose={() => close(false)}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
            Annuler
          </button>
          <button type="button" className={`btn ${current.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
            {current.confirm ?? 'Confirmer'}
          </button>
        </>
      }
    >
      {current.text && <p className="muted">{current.text}</p>}
    </Modal>
  );
}

export function ToastHost() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button type="button" key={t.id} className={`toast toast-${t.tone}`} onClick={() => dismiss(t.id)}>
          {t.tone === 'error' ? <CircleAlert size={18} /> : t.tone === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}

/** Jauge de budget : la couleur suit l'état (dans les clous / attention / dépassé). */
export function Meter({ value, max, status, label }: { value: number; max: number; status: BudgetStatus; label?: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={`meter meter-${status}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="meter-fill" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export function StatusPill({ status }: { status: BudgetStatus }) {
  if (status === 'none') return null;
  const Icon = status === 'ok' ? CheckCircle2 : status === 'warn' ? AlertTriangle : CircleAlert;
  const text = status === 'ok' ? 'OK' : status === 'warn' ? 'Attention' : 'Dépassé';
  return (
    <span className={`pill pill-${status}`}>
      <Icon size={13} aria-hidden />
      {text}
    </span>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = '', id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
