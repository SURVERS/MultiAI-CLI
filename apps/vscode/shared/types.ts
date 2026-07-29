import type { RunResult, StreamEvent } from "./legacy-sdk";

export interface SessionConfig {
  model: string;
  thinking?: boolean;
  effort?: string;
  /**
   * Whether the user explicitly changed the effort. Re-confirming the effort
   * already shown is not an explicit choice: the model is persisted but the
   * stored effort preference is left alone (mirrors the TUI's
   * persistModelSelection). Treated as true when omitted.
   */
  effortChanged?: boolean;
}

export interface ProjectFile {
  path: string;
  name: string;
  isDirectory: boolean;
}

export interface FileChange {
  path: string;
  status: "Modified" | "Added" | "Deleted";
  additions: number;
  deletions: number;
}

export interface ExtensionConfig {
  yoloMode: boolean;
  autosave: boolean;
  useCtrlEnterToSend: boolean;
  enableNewConversationShortcut: boolean;
  showThinkingContent: boolean;
  showThinkingExpanded: boolean;
  version: string;
}

export interface WorkspaceStatus {
  hasWorkspace: boolean;
  path?: string;
  workspaceRoot?: string;
}

export type ErrorPhase = "preflight" | "runtime";

export interface StreamError {
  type: "error";
  code: string;
  message: string;
  detail?: string; // 原始服务器错误信息
  phase: ErrorPhase;
  /**
   * `false` marks a mid-turn warning: the turn is still running, so UIs must
   * not treat it as turn-ending. Do not unlock the composer, offer Retry, or
   * flush the queued messages for non-terminal errors.
   */
  terminal?: boolean;
}

export type UIStreamEvent =
  | { type: "session_start"; sessionId: string; model?: string; _sessionId?: string }
  | { type: "stream_complete"; result: RunResult; _sessionId?: string }
  | (StreamError & { _sessionId?: string })
  | (StreamEvent & { _sessionId?: string });

export interface LoginStatus {
  loggedIn: boolean;
}

export interface AccountLimit {
  enabled: boolean;
  remaining_percent: number;
  reset_at?: string;
}

export interface AccountSnapshot {
  user: {
    sub: string;
    display_name?: string;
    avatar_url?: string;
    email?: string;
    email_verified?: boolean;
  };
  account: {
    wallet: {
      total: number;
      classic: number;
      new: number;
      billing_mode: string;
    };
    subscription: {
      active: boolean;
      available: boolean;
      limits: {
        five_hour: AccountLimit;
        weekly: AccountLimit;
        monthly: AccountLimit;
      };
    };
    generated_at: string;
  };
  keys: ReadonlyArray<{
    id: number;
    name: string;
    key: string;
    status: string;
  }>;
  connection: {
    id: string;
    client_id: string;
    client_name: string;
    device_name: string;
    scopes: readonly string[];
    expires_at: string;
  };
  generated_at: string;
}

export type { QuestionRequest, QuestionItem, QuestionOption, QuestionResponse } from "./legacy-sdk";
