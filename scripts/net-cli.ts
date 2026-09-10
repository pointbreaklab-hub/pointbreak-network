#!/usr/bin/env tsx
/**
 * net: the PointBreak CLI.
 *
 *   net list                 show every discovered extension and its state
 *   net enable <id>          flip an extension on
 *   net disable <id>         flip it off (it drops out of the bundle entirely)
 *   net deploy               build the static site
 *   net deploy --worker      build the site and deploy the receipt Worker
 *
 * Extensions are directories, not registry entries. This only edits the
 * `enabled` flag in each manifest.yaml; discovery happens at build time.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import type { ExtensionManifest } from '../src/lib/types';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXT_DIR = join(ROOT, 'src/extensions');

interface Found {
  id: string;
  file: string;
  manifest: ExtensionManifest;
}

function discover(): Found[] {
  return readdirSync(EXT_DIR)
    .filter((name) => statSync(join(EXT_DIR, name)).isDirectory())
    .flatMap((id) => {
      const file = join(EXT_DIR, id, 'manifest.yaml');
      try {
        const manifest = yaml.load(readFileSync(file, 'utf8')) as ExtensionManifest;
        return [{ id, file, manifest }];
      } catch {
        warn(`skipping ${id}: no readable manifest.yaml`);
        return [];
      }
    });
}

function list(): void {
  const found = discover();
  const width = Math.max(...found.map((f) => f.id.length), 4);

  for (const { id, manifest } of found) {
    const state = manifest.enabled ? '\x1b[32m on\x1b[0m' : '\x1b[90moff\x1b[0m';
    const routes = (manifest.routes ?? []).map((r) => r.path).join(' ');
    console.log(`${state}  ${id.padEnd(width)}  ${manifest.version}  ${routes}`);
  }
}

/**
 * Rewrites only the `enabled:` line so hand-written comments and key order in
 * the manifest survive. A yaml.dump round-trip would flatten both.
 */
function setEnabled(id: string, enabled: boolean): void {
  const target = discover().find((f) => f.id === id);
  if (!target) fail(`unknown extension "${id}". Run \`net list\` to see what exists.`);

  if (target.manifest.enabled === enabled) {
    console.log(`${id} is already ${enabled ? 'enabled' : 'disabled'}`);
    return;
  }

  const source = readFileSync(target.file, 'utf8');
  const updated = source.replace(/^enabled:\s*(true|false)\s*$/m, `enabled: ${enabled}`);

  if (updated === source) fail(`could not find an "enabled:" line in ${target.file}`);

  writeFileSync(target.file, updated);
  console.log(`${enabled ? 'enabled' : 'disabled'} ${id}`);
}

function deploy(withWorker: boolean): void {
  const enabled = discover().filter((f) => f.manifest.enabled);
  console.log(`building with ${enabled.length} extension(s): ${enabled.map((e) => e.id).join(', ')}`);

  run('npm', ['run', 'build']);

  if (withWorker) {
    console.log('deploying receipt worker…');
    run('npx', ['wrangler', 'deploy', '--config', 'worker/wrangler.toml']);
  }

  console.log('\nbuild ready in ./build');
  console.log('Pages deploys on push to main. See .github/workflows/deploy-pages.yml');
}

function run(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
}

function warn(message: string): void {
  console.warn(`\x1b[33mwarn\x1b[0m  ${message}`);
}

function fail(message: string): never {
  console.error(`\x1b[31merror\x1b[0m ${message}`);
  process.exit(1);
}

function usage(): void {
  console.log(`net: PointBreak CLI

  net list              show every extension and whether it is enabled
  net enable <id>       enable an extension
  net disable <id>      disable an extension
  net deploy            build the static site
  net deploy --worker   build, then deploy the receipt Worker
`);
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case 'list':
    list();
    break;
  case 'enable':
    setEnabled(rest[0] ?? fail('usage: net enable <id>'), true);
    break;
  case 'disable':
    setEnabled(rest[0] ?? fail('usage: net disable <id>'), false);
    break;
  case 'deploy':
    deploy(rest.includes('--worker'));
    break;
  default:
    usage();
    if (command) process.exit(1);
}
