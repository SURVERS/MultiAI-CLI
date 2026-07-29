declare const __MULTIAI_VERSION__: string | undefined;
declare const __MULTIAI_CHANNEL__: string | undefined;
declare const __MULTIAI_COMMIT__: string | undefined;
declare const __MULTIAI_BUILD_TARGET__: string | undefined;

export interface MultiAIBuildInfo {
  readonly version?: string;
  readonly channel?: string;
  readonly commit?: string;
  readonly buildTarget?: string;
}

function optionalBuildString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const MULTIAI_BUILD_INFO: MultiAIBuildInfo = {
  version:
    typeof __MULTIAI_VERSION__ === 'string'
      ? optionalBuildString(__MULTIAI_VERSION__)
      : undefined,
  channel:
    typeof __MULTIAI_CHANNEL__ === 'string'
      ? optionalBuildString(__MULTIAI_CHANNEL__)
      : undefined,
  commit:
    typeof __MULTIAI_COMMIT__ === 'string'
      ? optionalBuildString(__MULTIAI_COMMIT__)
      : undefined,
  buildTarget:
    typeof __MULTIAI_BUILD_TARGET__ === 'string'
      ? optionalBuildString(__MULTIAI_BUILD_TARGET__)
      : undefined,
};
