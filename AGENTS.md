<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Coding guidelines

- Use the simplest implementation that fully solves the problem. Reuse existing code where it fits and add abstractions only when they make the code easier to understand or maintain.
- Verify the change through its normal entry point and cover relevant failure cases.
- Write code that people can read easily. Use descriptive names and straightforward control flow. Use comments to explain decisions that are hard to infer from the code.
- Always remove temporary files you create for a task once they are no longer needed. Clean them up before finishing, even if a command fails.

## Repository structure

- Group related files by feature or purpose. Use short role names within each folder, such as `access.ts`, `mutations.ts`, and `queries.ts`. Give React component files the same descriptive name as their component.
- Keep feature code beside its routes in private folders such as `_components` and `_lib`. Group reusable UI by purpose in `app/components/` and shared helpers by feature in `app/lib/`. Preserve Next.js entry points and public URLs when moving internal files.
- Keep the Prisma client, schema, and migrations under `server/db/`. Preserve existing migration paths and history when reorganizing code.
- Group tests under `tests/` by the feature or responsibility they cover. When moving files, update their imports, affected npm scripts, and the repository map in `README.md`.
