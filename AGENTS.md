# Agent instructions

## Git commits

**Always auto git commit after finishing a feature.**

When a feature (or a coherent unit of work) is complete:

1. Stage only the files that belong to that work.
2. Create a git commit with a clear, complete-sentence message describing what changed and why.
3. Do not wait for an explicit “commit this” request unless the change is destructive, ambiguous, or touches secrets / shared remotes in a risky way.

Prefer small, focused commits that match the feature just completed. Do not amend published history or force-push unless the user explicitly asks.
