import type { JsonObject, PermissionMode } from "@multiai/sdk";

export const SESSION_APPROVAL_METADATA_KEY = "vscode_multiai_approval";

export interface SessionApprovalFlags {
  readonly yolo: boolean;
  readonly afk: boolean;
}

export function readSessionApprovalFlags(
  metadata: Readonly<Record<string, unknown>> | undefined,
): SessionApprovalFlags | undefined {
  const value = metadata?.[SESSION_APPROVAL_METADATA_KEY];
  return parseSessionApprovalFlags(value);
}

function parseSessionApprovalFlags(value: unknown): SessionApprovalFlags | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const yolo = Reflect.get(value, "yolo");
  const afk = Reflect.get(value, "afk");
  if (typeof yolo !== "boolean" && typeof afk !== "boolean") return undefined;
  return {
    yolo: typeof yolo === "boolean" ? yolo : false,
    afk: typeof afk === "boolean" ? afk : false,
  };
}

export function sessionApprovalMetadata(flags: SessionApprovalFlags): JsonObject {
  return {
    [SESSION_APPROVAL_METADATA_KEY]: {
      yolo: flags.yolo,
      afk: flags.afk,
    },
  };
}

export function corePermissionForSessionApproval(flags: SessionApprovalFlags): PermissionMode {
  if (flags.afk) return "auto";
  return flags.yolo ? "yolo" : "manual";
}

/**
 * The global `multiai.yoloMode` setting is authoritative whenever a session
 * attaches to the runtime; afk stays per-session because it has no global
 * setting counterpart.
 */
export function withGlobalYoloMode(
  flags: SessionApprovalFlags,
  yoloMode: boolean,
): SessionApprovalFlags {
  return flags.yolo === yoloMode ? flags : { yolo: yoloMode, afk: flags.afk };
}
