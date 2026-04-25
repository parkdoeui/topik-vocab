# CLAUDE.md

## After pushing changes to master

The deploy workflow runs automatically on push to `master` and publishes to GitHub Pages.

To verify a change is working after deployment:

1. **Run build and lint locally first:**
   ```
   npm run build
   npm run lint
   ```

2. **Check the GitHub Actions workflow:**
   ```
   gh run list --limit 5
   gh run watch
   ```

3. **Visit the deployed site:**
   https://parkdoeui.github.io/topik-vocab/

   Confirm the change is live and the page loads correctly.
