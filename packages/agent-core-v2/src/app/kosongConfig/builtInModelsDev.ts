// Filled by tsdown define in release builds (same mechanism as the CLI's
// apps/multiai-cli built-in catalog): the final bundler (kap-server's tsdown)
// injects the generated models.dev snapshot. Source stays empty so the
// snapshot is not committed.
declare const __MULTIAI_BUILT_IN_CATALOG__: string | undefined;

export const BUILT_IN_MODELS_DEV_JSON: string | undefined =
  typeof __MULTIAI_BUILT_IN_CATALOG__ === 'string'
    ? __MULTIAI_BUILT_IN_CATALOG__
    : undefined;
