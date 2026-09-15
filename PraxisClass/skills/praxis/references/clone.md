# Clone Or Reuse Existing Repo

## Goal

Establish which PraxisClass checkout will be used for setup and runtime actions.

## Procedure

1. Check whether PraxisClass already exists locally.
2. If a checkout exists, show the path and ask whether to reuse it.
3. If no checkout exists, ask the user for the repository URL or source bundle supplied by their deployment operator.
4. Propose the exact acquisition command and ask for confirmation.
5. After the source is available, confirm dependency installation separately.

## Recommended Path

- Recommended: reuse an existing checkout if it is already on the target branch.
- Otherwise: use the operator-provided repository source, then install dependencies.
- Never invent or substitute an unofficial repository URL.

## Commands

When the deployment operator supplied a Git repository URL:

```bash
git clone <REPOSITORY_URL> praxisclass
cd praxisclass
```

Install dependencies:

```bash
pnpm install
```

## Confirmation Requirements

- Ask before `git clone` or extracting a source bundle.
- Ask before `pnpm install`.
- If the repo is dirty, tell the user and ask whether to continue with that checkout.
