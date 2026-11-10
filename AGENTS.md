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
