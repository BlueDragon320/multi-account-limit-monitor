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
      className="fixed inset-0 bg-[#0C0A09]/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1917] border border-[rgba(255,255,255,0.12)] rounded-[24px] p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] text-[#E7E5E4]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-4 mb-6 border-b border-[rgba(255,255,255,0.1)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#141210] border border-[rgba(255,255,255,0.1)] text-[#D4F268]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 id="account-modal-title" className="font-serif font-light text-2xl text-[#E7E5E4] tracking-tight">
                {account ? 'Edit Account' : 'Add New Account'}
              </h2>
              <p className="text-xs text-[#A8A29E] font-sans mt-0.5">
                {account ? 'Modify identity attributes & organizational notes' : 'Register an account tier or organizational workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#A8A29E] hover:text-[#E7E5E4] hover:bg-[#292524] transition-all cursor-pointer border-0 bg-transparent shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.3)] text-[#f87171] text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="acc-name" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Account Display Name <span className="text-[#D4F268]">*</span>
            </label>
            <input
              id="acc-name"
              type="text"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              placeholder="e.g., Personal Google Workspace, Production Cloud"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <p className="text-[11px] text-[#A8A29E] mt-1.5 font-mono">
              A friendly label to distinguish this account across limit windows.
            </p>
          </div>

          <div>
            <label htmlFor="acc-email" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Email / Identifier (Optional)
            </label>
            <input
              id="acc-email"
              type="email"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all"
              placeholder="e.g., developer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-[#A8A29E] mt-1.5 font-mono">
              Never used for authentication. Strictly an offline reference identifier.
            </p>
          </div>

          <div>
            <label htmlFor="acc-notes" className="text-xs font-sans font-medium text-[#A8A29E] uppercase tracking-wider block mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              id="acc-notes"
              className="w-full bg-[#141210] border border-[rgba(255,255,255,0.12)] text-[#E7E5E4] rounded-xl px-3.5 py-2.5 text-sm font-sans outline-none focus:border-[#D4F268] focus:ring-1 focus:ring-[#D4F268] transition-all min-h-[85px] resize-y"
              placeholder="Tier details, billing dates, or specific quota notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {account && (
            <div className="p-3 bg-[#141210] rounded-xl border border-[rgba(255,255,255,0.08)]">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-mono text-[#E7E5E4]">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#0C0A09] border border-[rgba(255,255,255,0.2)] text-[#D4F268] accent-[#D4F268] focus:ring-0 cursor-pointer"
                />
                <span>Archive this account (hides from active overview)</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(255,255,255,0.1)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-dark-solid bg-[#292524] text-[#E7E5E4] px-4 py-2 rounded-full text-sm border border-[rgba(255,255,255,0.1)] hover:bg-[#383431] transition-all font-sans cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-lime bg-[#D4F268] text-[#0C0A09] font-semibold px-5 py-2 rounded-full text-sm hover:bg-[#c4e450] transition-all shadow-[0_0_12px_rgba(212,242,104,0.2)] font-sans cursor-pointer"
            >
              {account ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
