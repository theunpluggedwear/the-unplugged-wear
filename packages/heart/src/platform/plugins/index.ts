const disabled = new Set(
  (process.env.TUW_DISABLED_PLUGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

const plugins = new Map<string, unknown>();

export function registerFeaturePlugin<T>(id: string, impl: T): void {
  plugins.set(id, impl);
}

export function getFeaturePlugin<T>(id: string): T | null {
  if (disabled.has(id)) return null;
  return (plugins.get(id) as T | undefined) ?? null;
}

export function isFeaturePluginEnabled(id: string): boolean {
  return !disabled.has(id) && plugins.has(id);
}

export function listFeaturePlugins(): string[] {
  return [...plugins.keys()].filter((id) => !disabled.has(id));
}
