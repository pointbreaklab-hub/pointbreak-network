/**
 * Extension auto-discovery.
 *
 * Every directory under src/extensions/ with a manifest.yaml is picked up at
 * build time. Adding a feature means adding a folder. No central list to edit.
 * Disabled extensions are dropped here and tree-shaken out of the bundle.
 */

import type { ExtensionManifest, ExtensionRoute, LoadedExtension } from '$lib/types';

const manifests = import.meta.glob<ExtensionManifest>('../extensions/*/manifest.yaml', {
  eager: true,
  import: 'default'
});

const components = import.meta.glob('../extensions/*/components/*.svelte');

function idFromPath(path: string): string {
  return path.split('/')[2];
}

export function loadEnabledExtensions(): LoadedExtension[] {
  const loaded: LoadedExtension[] = [];

  for (const [path, manifest] of Object.entries(manifests)) {
    if (!manifest?.enabled) continue;

    const id = idFromPath(path);
    if (manifest.id !== id) {
      console.warn(`[registry] ${path}: manifest id "${manifest.id}" != directory "${id}"`);
      continue;
    }

    const owned: Record<string, () => Promise<unknown>> = {};
    for (const [componentPath, loader] of Object.entries(components)) {
      if (idFromPath(componentPath) !== id) continue;
      owned[componentPath.split(`${id}/`)[1]] = loader;
    }

    loaded.push({ manifest, components: owned });
  }

  const seen = new Set<string>();
  for (const ext of loaded) {
    for (const route of ext.manifest.routes ?? []) {
      if (seen.has(route.path)) {
        throw new Error(`[registry] duplicate route "${route.path}" from extension "${ext.manifest.id}"`);
      }
      seen.add(route.path);
    }
  }

  return loaded.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}

export interface NavItem extends ExtensionRoute {
  extensionId: string;
}

export function navItems(extensions: LoadedExtension[]): NavItem[] {
  return extensions
    .flatMap((ext) =>
      (ext.manifest.routes ?? [])
        .filter((r) => r.nav)
        .map((r) => ({ ...r, extensionId: ext.manifest.id }))
    )
    .sort((a, b) => (a.nav?.order ?? 999) - (b.nav?.order ?? 999));
}

/**
 * Find the component an enabled extension registered for a route path.
 * Returns null when no enabled extension claims it, which is how a route
 * stays inert after `net disable` instead of 404-ing.
 */
export function componentFor(
  extensions: LoadedExtension[],
  path: string
): (() => Promise<unknown>) | null {
  for (const ext of extensions) {
    const route = (ext.manifest.routes ?? []).find((r) => r.path === path);
    if (route) return ext.components[route.component] ?? null;
  }
  return null;
}
