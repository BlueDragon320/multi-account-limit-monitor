# Skills and practices for implementation agents

Use available skills when they fit the task, following their current SKILL.md instructions. Skill availability depends on the agent environment; do not fabricate a skill or block implementation solely because a suggested skill is unavailable.

- **Web application implementation:** build a responsive, accessible interface with a small, maintainable framework and clear separation of components, persistence, and domain logic.
- **Time and date modeling:** use a time-zone-aware library or platform API suitable for the chosen stack. Test explicit reset anchors, DST transitions, monthly end-of-month behavior, and multiple missed periods. Document the exact rules.
- **Data modeling and local persistence:** model accounts, services, limit windows, projects, usage events, per-window effects, and corrections with stable identifiers. Version stored data and imports; validate before replacing data. Preserve history across edits and resets.
- **Interaction and accessibility:** use semantic controls, keyboard support, readable status text, confirmation for destructive actions, responsive layouts, and useful empty and error states.
- **Testing and verification:** write focused tests for quota calculations, resets, corrections, event effects, and invalid imports. Run the project's checks and exercise the main flows in a browser if available.
- **Documentation:** explain installation, running, local-only storage, backups, reset semantics, assumptions, and the manual nature of all estimates.

If a website-building skill is available and appropriate, read it before implementing. If actual provider integrations are later requested, verify current official documentation and authorization requirements before designing them.
