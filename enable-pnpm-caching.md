# Re-enabling pnpm Caching in GitHub Actions

After your first successful GitHub Actions run with pnpm (which generates `pnpm-lock.yaml`), you can re-enable caching for faster builds.

## Step 1: Verify pnpm-lock.yaml exists

Make sure `pnpm-lock.yaml` has been generated and committed to your repository.

## Step 2: Update GitHub Actions workflows

In both `.github/workflows/deploy-staging.yml` and `.github/workflows/deploy-prod.yml`, change:

**From:**
```yaml
- name: Use Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    # cache: 'pnpm'  # Disabled until pnpm-lock.yaml is generated
```

**To:**
```yaml
- name: Use Node.js ${{ matrix.node-version }}
  uses: actions/setup-node@v4
  with:
    node-version: ${{ matrix.node-version }}
    cache: 'pnpm'
```

## Step 3: Commit and test

```bash
git add .github/workflows/
git commit -m "Re-enable pnpm caching in GitHub Actions"
git push
```

## Expected Benefits

After re-enabling caching:
- ⚡ **Faster installs**: Dependencies cached between runs
- 💰 **Reduced CI costs**: Less time downloading packages
- 🔄 **Better reliability**: Consistent dependency versions

## Alternative: Manual Cache Setup

For more control, you can use manual caching:

```yaml
- name: Get pnpm store directory
  shell: bash
  run: |
    echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

This manual approach gives you more flexibility but requires more configuration.