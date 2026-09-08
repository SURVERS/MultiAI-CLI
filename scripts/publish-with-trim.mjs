// Publish wrapper: `changeset publish` + trim GitHub Release bodies.
//
// The changesets GitHub action creates a Release whose body is the full
// changelog content for the released version. The 1.0.0 entry alone is
// ~250 KB, exceeding the 125,000-character GitHub Release body limit, which
// fails the whole publish step even though npm publish already succeeded.
// After a successful publish we clamp every oversized release body back
// under the limit via the REST API.

import { execFileSync, execSync } from 'node:child_process';

const REPO = 'SURVERS/MultiAI-CLI';
const MAX_BODY_CHARS = 100_000;
const TRUNCATION_NOTICE = [
  '',
  '> _This changelog was truncated for the GitHub Release body limit._',
  '> _The full changelog lives in the repository: `apps/multiai-cli/CHANGELOG.md`._',
].join('\n');

/** Runs a command, throwing with captured stderr on failure. */
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

/** PATCHes the release body through the REST API using the workflow token. */
function updateReleaseBody(releaseId, body) {
  const payload = JSON.stringify({ body });
  run('gh', [
    'api',
    '-X', 'PATCH',
    `repos/${REPO}/releases/${releaseId}`,
    '-H', 'Accept: application/vnd.github+json',
    '--input', '-',
  ], { input: payload });
}

function clampBody(body) {
  return `${body.slice(0, MAX_BODY_CHARS)}\n…\n${TRUNCATION_NOTICE}`;
}

async function main() {
  execSync('pnpm changeset publish', { stdio: 'inherit' });

  let releases;
  try {
    releases = JSON.parse(
      run('gh', ['api', `repos/${REPO}/releases?per_page=15`]),
    );
  } catch (error) {
    console.warn(`[publish] skipped release body trim: ${error.message}`);
    return;
  }

  for (const release of releases) {
    if (release.draft === true) continue;
    if (typeof release.body !== 'string' || release.body.length <= MAX_BODY_CHARS) continue;
    updateReleaseBody(release.id, clampBody(release.body));
    console.log(`[publish] trimmed release body: ${release.tag_name} (${release.body.length} → ${MAX_BODY_CHARS} chars)`);
  }
}

main().catch((error) => {
  console.error(`[publish] publish or release body trim failed: ${error.message}`);
  process.exitCode = 1;
});
