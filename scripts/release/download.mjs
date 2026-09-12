import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// conf-app falls back when the release asset is absent/unavailable.
// A present but corrupt archive still fails extraction.
export function prepareRelease({ download, destination = '.' }) {
  let archive;
  try {
    archive = download();
    if (statSync(archive).size === 0) return false;
  } catch {
    return false;
  }
  execFileSync('tar', ['-xzf', archive, '-C', destination, 'web/dist'], { stdio: 'pipe' });
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prebuilt = prepareRelease({ download: () => {
    mkdirSync('prebuilt', { recursive: true });
    execFileSync('gh', ['release', 'download', process.env.RELEASE_TAG, '--repo', process.env.GITHUB_REPOSITORY, '--pattern', 'deploy.tar.gz', '--dir', 'prebuilt'], { stdio: 'inherit' });
    return 'prebuilt/deploy.tar.gz';
  } });
  appendFileSync(process.env.GITHUB_OUTPUT, `prebuilt=${prebuilt}\n`);
  if (!prebuilt) console.log('::warning::Release bundle unavailable; rebuilding the checked-out tag with frozen lockfiles');
}
