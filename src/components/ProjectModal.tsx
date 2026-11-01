import React, { useState, useEffect } from 'react';
import { X, Folder } from 'lucide-react';
import { Project } from '../domain/types';

interface ProjectModalProps {
  isOpen: boolean;
  project?: Project | null;
  onSave: (data: { name: string; notes?: string; archived?: boolean }) => void;
  onClose: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  project,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(() => (project ? project.name : ''));
  const [notes, setNotes] = useState(() => (project ? project.notes || '' : ''));
  const [archived, setArchived] = useState(() => (project ? project.archived : false));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (project) {
      setName(project.name);
      setNotes(project.notes || '');
      setArchived(project.archived);
    } else {
      setName('');
      setNotes('');
      setArchived(false);
    }
    setError(null);
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name is required.');
      return;
    }

    onSave({
      name: trimmed,
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
      aria-labelledby="project-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-window max-w-md p-6 bg-[#252422] border border-[#2e2c29] text-[#FBFAF9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2e2c29]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#181818] border border-[#2e2c29] text-[#FF6542]">
              <Folder className="w-4 h-4" />
            </div>
            <h3 id="project-modal-title" className="text-sm font-semibold text-[#FBFAF9]">
              {project ? 'Edit Project' : 'Create Project'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#898580] hover:text-[#FBFAF9] bg-transparent border-0 cursor-pointer p-1 rounded hover:bg-[#2e2c29]"
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
            <label htmlFor="proj-name" className="label-text">
              Project Name <span className="text-[#FF6542]">*</span>
            </label>
            <input
              id="proj-name"
              type="text"
              className="input-control"
              placeholder="e.g., Code Search Benchmark, Documentation Crawler"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="proj-notes" className="label-text">
              Notes (Optional)
            </label>
            <textarea
              id="proj-notes"
              className="input-control min-h-[70px] resize-y"
              placeholder="Objectives, expected quota footprint, or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {project && (
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-[#FBFAF9]">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                  className="rounded bg-[#030302] border-[#2e2c29] text-[#FF6542]"
                />
                <span>Archive this project</span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2e2c29]">
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
              {project ? 'Save Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
