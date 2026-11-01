# Product and design brief

## Purpose

A calm personal control panel for comparing available quota across accounts and tracking which projects consumed it. The user maintains the figures manually, so recency and reset timing matter as much as remaining capacity.

## Primary screens

1. **Overview:** summary of accounts and active windows; sortable or filterable cards or rows showing account, service, remaining, used, next reset (with time zone), and last updated. Surface low or stale values with text as well as color. Include quick actions to log usage and correct a balance.
2. **Accounts and limits:** manage accounts, services, and multiple windows independently. Show clear cadence, reset anchor, capacity, units, and next reset. Provide sensible editable presets for the four named services without inventing numerical quotas or reset times.
3. **Projects and history:** create projects and review usage records. Filter by account, service, project, and date. Group totals only when units and limit context make comparison meaningful.
4. **Settings and data:** time-zone defaults, low-capacity and stale-data thresholds, JSON export/import, and storage explanation.

## Core interactions

- A short setup flow adds an account, selects a service, and configures one or more limit windows. Make clear that hourly and weekly windows can coexist and reset separately.
- A usage form asks for project, account, service, amount and affected window(s), plus date and optional note. If a single event affects multiple windows, save one event with explicit per-window effects. Preview the resulting balances before saving.
- A correction form records the new observed value and reason, preserving the previous value in history. Clearly distinguish corrections from project usage.
- Show a reset countdown and an absolute local date and time with its zone. Explain how monthly anchors beyond a month's last day are handled. Editing an anchor changes future resets without rewriting history.
- Confirm destructive actions. Support archive for items with history. Present validation near the relevant field and allow cancellation.

## Visual direction

Use a clean, compact dashboard with generous spacing, a restrained neutral palette, one accent color, readable typography, and subtle borders. Use progress bars with numeric labels and accessible contrast; avoid depending on color alone. Desktop can use a compact navigation sidebar and a comparison table; mobile should use stacked cards and a simple navigation. Prioritize fast scanning and quick updates over decoration. Include clear empty states and sample-free onboarding so estimates cannot be confused with real usage.
