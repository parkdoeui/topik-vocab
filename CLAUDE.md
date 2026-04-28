# CLAUDE.md

## Before pushing changes to master

Always run build and lint locally before pushing:
```
npm run build
npm run lint
```

## After pushing changes to master

The deploy workflow runs automatically on push to `master` and publishes to GitHub Pages.

After pushing, check whether the deploy succeeded:

```
gh run list --limit 5
```

If the latest run shows `failure`, inspect the logs:

```
gh run view <run-id> --log-failed
```

**If the deploy failed, fix the errors and push a follow-up commit.** Do not leave master in a broken deploy state.

Once the deploy succeeds, visit the deployed site to confirm:
https://parkdoeui.github.io/topik-vocab/
