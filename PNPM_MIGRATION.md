# Migration from Yarn to pnpm

This project has been migrated from Yarn to pnpm for better performance and disk space efficiency.

## What Changed

### Package Management
- **yarn.lock** → **pnpm-lock.yaml** (will be generated after first install)
- **yarn** commands → **pnpm** commands in all scripts and documentation

### Configuration Files Updated
- `package.json` - Updated scripts, volta configuration, and React dependencies
- `vite.config.js` - Migrated from @preact/preset-vite to @vitejs/plugin-react
- `.travis.yml` - Updated CI configuration
- `.github/workflows/` - Updated GitHub Actions
- `README.md` - Updated development instructions
- `CONTRIBUTING.md` - Updated contribution guidelines
- `.gitignore` - Updated ignore patterns

### Benefits of pnpm
- **Faster installations**: Up to 2x faster than yarn
- **Disk space efficiency**: Packages are hard-linked from a global store
- **Strict node_modules**: Better dependency resolution
- **Monorepo support**: Native support for workspaces
- **Version consistency**: Uses `packageManager` field for automatic version detection

## Migration Commands

### For New Contributors
```bash
# Install pnpm globally (if not already installed)
npm install -g pnpm@9.15.0

# Install dependencies
pnpm install

# Start development
pnpm dev

# Build project
pnpm build
```

### For Existing Contributors
```bash
# Remove old node_modules and yarn.lock (if you still have them)
rm -rf node_modules yarn.lock

# Install pnpm globally
npm install -g pnpm@9.15.0

# Install dependencies with pnpm
pnpm install

# Continue development as usual
pnpm dev
```

## Script Changes

All npm scripts remain the same, just use `pnpm` instead of `yarn`:

| Old Command | New Command |
|-------------|-------------|
| `yarn install` | `pnpm install` |
| `yarn dev` | `pnpm dev` |
| `yarn build` | `pnpm build` |
| `yarn test` | `pnpm test` |
| `yarn lint` | `pnpm lint` |

## Configuration

The project includes a `.npmrc` file with optimized pnpm settings:
- Auto-install peer dependencies
- Proper ESLint and Prettier hoisting
- Strict dependency management

### Version Management
The project uses the `packageManager` field in `package.json` to specify the exact pnpm version:
```json
{
  "packageManager": "pnpm@9.15.0"
}
```

This ensures all developers and CI/CD environments use the same pnpm version automatically, without needing to specify versions in GitHub Actions or other tools.

## First Run After Migration

After migrating to pnpm, the first GitHub Actions run may need special handling:

1. **Missing pnpm-lock.yaml**: The first run will generate this file
2. **Caching disabled temporarily**: Re-enable after the lockfile exists
3. **Commit the generated lockfile**: This ensures consistent installs

### Steps after first successful run:
```bash
# The first run will generate pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "Add pnpm-lock.yaml"

# Then re-enable caching in GitHub Actions
# Edit .github/workflows/*.yml and uncomment: cache: 'pnpm'
```

## Troubleshooting

If you encounter issues:

1. **Clear pnpm cache**: `pnpm store prune`
2. **Reinstall dependencies**: `rm -rf node_modules && pnpm install`
3. **Check pnpm version**: `pnpm --version` (should be 9.15.0+)
4. **Missing lockfile error**: Run `pnpm install` locally first to generate pnpm-lock.yaml

For more information about pnpm, visit: https://pnpm.io/