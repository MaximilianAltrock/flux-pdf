# Branch Protection Setup (Main)

This repo's CI gates are implemented in `.github/workflows/ci.yaml` via the `quality` and `e2e` jobs.

To enforce merge blocking on failing gates, apply branch protection on `main` with required checks.

## Required checks

- `quality`
- `e2e`

## Apply protection

Set one of these tokens first:

- `GITHUB_TOKEN`
- `GH_TOKEN`

Then run:

```bash
npm run branch-protection:apply -- --repo=<owner>/<repo> --branch=main
```

If `GITHUB_REPOSITORY` is already set in your environment, `--repo` can be omitted.

## Verify protection

```bash
npm run branch-protection:verify -- --repo=<owner>/<repo> --branch=main
```

This validates that:

- required status checks include `quality` and `e2e`
- at least one approving review is required

## Verification Evidence

Record each verification run here:

| Date (UTC) | Repository | Branch | Result | Required checks observed |
| --- | --- | --- | --- | --- |
| Pending | Pending | `main` | Not yet verified in this workspace session | `quality`, `e2e` (expected) |
