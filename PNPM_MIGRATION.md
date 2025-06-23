# Migration from Yarn to pnpm

This project has been migrated from Yarn to pnpm for better performance and disk space efficiency.

## What Changed

### Package Management
- **yarn.lock** → **pnpm-lock.yaml** (will be generated after first install)
- **yarn** commands → **pnpm** commands in all scripts and documentation

### Configuration Files Updated
- `package.json` - Updated scripts and volta configuration
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

## Migration Commands

### For New Contributors
```bash
# Install pnpm globally (if not already installed)
npm install -g pnpm@8.15.0

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
npm install -g pnpm@8.15.0

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

## Troubleshooting

If you encounter issues:

1. **Clear pnpm cache**: `pnpm store prune`
2. **Reinstall dependencies**: `rm -rf node_modules && pnpm install`
3. **Check pnpm version**: `pnpm --version` (should be 8.15.0+)

For more information about pnpm, visit: https://pnpm.io/