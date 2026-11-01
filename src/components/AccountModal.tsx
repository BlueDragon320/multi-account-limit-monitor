import React, { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { Account } from '../domain/types';

interface AccountModalProps {
  isOpen: boolean;
  account?: Account | null; // if provided, editing mode; otherwise create
  onSave: (data: { name: string; email?: string; notes?: string; archived?: boolean }) => void;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  account,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(() => (account ? account.name : ''));
  const [email, setEmail] = useState(() => (account ? account.email || '' : ''));
  const [notes, setNotes] = useState(() => (account ? account.notes || '' : ''));
  const [archived, setArchived] = useState(() => (account ? !!account.archived : false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setEmail(account.email || '');
      setNotes(account.notes || '');
      setArchived(!!account.archived);
    } else {
      setName('');
      setEmail('');
      setNotes('');
      setArchived(false);
    }
    setError(null);
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Account name is required.');
      return;
    }

    onSave({
      name: trimmedName,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      archived,
    });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-window max-w-lg p-6 bg-[#1C1917] border border-[rgba(255,255,255,0.1)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <User className="w-4 h-4" />
            </div>
            <h3 id="account-modal-title" className="text-sm font-semibold text-[#E7E5E4]">
              {account ? 'Edit Account' : 'Add New Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#A8A29E] hover:text-[#E7E5E4] bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-[rgba(255,255,255,0.1)]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="acc-name" className="label-text">
              Account Display Name <span className="text-[#D4F268]">*</span>
            </label>
            <input
              id="acc-name"
              type="text"
              className="input-control"
              placeholder="e.g., Personal Google Workspace, Production Cloud"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <p className="text-[11px] text-[#A8A29E] mt-1 font-mono">
              A friendly label to distinguish this account across limit windows.
            </p>
          </div>

          <div>
            <label htmlFor="acc-email" className="label-text">
              Email / Identifier (Optional)
            </label>
            <input
              id="acc-email"
              type="email"
              className="input-control"
              placeholder="e.g., developer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-[#A8A29E] mt-1 font-mono">
              Never used for authentication. Strictly an offline reference identifier.
            </p>
          </div>

          <div>
            <label htmlFor="acc-notes" className="label-text">
              Notes (Optional)
            </label>
            <textarea
              id="acc-notes"
              className="input-control min-h-[70px] resize-y"
              placeholder="Tier details, billing dates, or specific quota notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {account && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#E7E5E4]">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="rounded bg-[#0C0A09] border-[rgba(255,255,255,0.1)] text-[#D4F268] focus:ring-0"
                />
                <span>Archive this account (hides from active overview)</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.1)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark-solid text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-cream text-xs font-semibold"
            >
              {account ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
