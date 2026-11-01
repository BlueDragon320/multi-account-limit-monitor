# Agent instructions

Build a simple, responsive, local-first website for tracking usage limits across multiple Google accounts. The owner manually enters and updates values; do not assume access to Google billing, usage APIs, or automatic synchronization.

## Outcome

Provide a dashboard showing accounts, services, remaining capacity, and upcoming resets so the owner can choose an account efficiently. Support Antigravity (hourly and weekly limits), Google Flow (monthly), Google AI Studio (daily), Gemini (daily), and custom services and limits. These are user-configured tracking categories, not claims about Google's current plans or actual quotas.

## Required behavior

- Add, edit, archive, and restore accounts with a display name, optional email, and notes. Never request passwords or tokens.
- Add, edit, archive, and restore services and multiple independent limit windows per account and service. Each window has a name, capacity, unit (percent, credits, requests, or custom), reset cadence, reset date and time, and time zone. Support hourly, daily, weekly, monthly, and custom intervals, including differing anchors. Preserve the configured reset behavior across daylight-saving changes and month ends; make the next reset visible.
- Enter a current balance or usage manually, and record an adjustment with timestamp, account, service, window, project, amount or percentage, and optional note. Show a history filterable by account, service, project, and date. Allow editing and deleting entries with clear confirmation. Prevent accidental double counting when a single usage event applies to multiple windows.
- Support projects with names and optional notes. Show totals by project with units kept separate. Percentages must specify the window and its capacity; do not add unlike units or percentages from different capacities as if comparable.
- Display remaining and used values, reset time, and last updated time; highlight low capacity and stale estimates. Allow manual correction with an audit entry. Explain that values are estimates. Do not automatically infer usage from time elapsed.
- On reset, advance each window from its configured anchor and retain history. Handle missed resets and month-end dates predictably. Define and document whether resetting clears current usage; default to zero at each reset, with a manual correction available. Avoid changing historic entries.
- Persist data locally across reloads. Provide versioned JSON export and import, with validation and a clear choice to replace or cancel; confirm before replacement. Warn users that local browser data can be lost and is specific to the browser/device. No server or sign-in is required for the initial version.
- Provide accessible labels, keyboard operation, responsive layouts, empty states, and useful validation. Never silently overwrite records.

## Working agreement

Read design.md and skills.md before implementation. Inspect existing files and respect user changes. Choose a small, maintainable stack and document setup, storage, reset rules, assumptions, and limitations in a README. Keep business logic separate from UI. Add meaningful tests for reset calculations (time zones, DST, month ends, and missed resets), usage adjustments, and import validation. Run appropriate checks and report results. Do not invent provider integrations or quota values. Ask only when an ambiguity blocks implementation; otherwise make reasonable defaults editable.
