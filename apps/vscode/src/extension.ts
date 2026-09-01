import * as vscode from "vscode";

import { Events } from "../shared/bridge";
import { MultiAIWebviewProvider } from "./MultiAIWebviewProvider";
import { onSettingsChange, VSCodeSettings } from "./config/vscode-settings";
import { updateLoginContext } from "./utils/context";

let outputChannel: vscode.OutputChannel | undefined;
let provider: MultiAIWebviewProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("MultiAI CLI");
  const remoteInfo = vscode.env.remoteName ? ` (remote: ${vscode.env.remoteName})` : "";
  log(`MultiAI CLI ${VSCodeSettings.getExtensionConfig().version} activating${remoteInfo}`);

  provider = new MultiAIWebviewProvider(
    context.extensionUri,
    context,
    () => outputChannel?.show(),
    (message) => log(message),
  );
  context.subscriptions.push(provider, outputChannel);

  try {
    await updateLoginContext(provider.harness);
  } catch (error) {
    logError("Unable to determine login status", error);
  }

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider("multiai-baseline", {
      provideTextDocumentContent: async (uri) => {
        const sessionId = new URLSearchParams(uri.query).get("sessionId");
        if (!sessionId || !provider) return "";
        const relativePath = decodeURIComponent(uri.path.replace(/^\//, ""));
        try {
          return await provider.getBaselineContent(sessionId, relativePath);
        } catch (error) {
          logError("Unable to open baseline content", error);
          return "";
        }
      },
    }),
  );

  context.subscriptions.push(
    onSettingsChange((changedKeys) => {
      provider?.broadcast(Events.ExtensionConfigChanged, {
        config: VSCodeSettings.getExtensionConfig(),
        changedKeys,
      });
      if (changedKeys.includes("yoloMode")) {
        void provider
          ?.setYoloModeForActiveSessions(VSCodeSettings.yoloMode)
          .catch((error) => logError("Unable to update session permission", error));
      }
    }),
    vscode.window.registerWebviewViewProvider("multiai.webview", provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const commands: Record<string, () => void | Promise<void>> = {
    "multiai.clearAllState": async () => {
      await context.globalState.update("multiai.config", undefined);
      await context.globalState.update("multiai.mcpServers", undefined);
      await context.workspaceState.update("multiai.mcpEnabled", undefined);
      await vscode.window.showInformationMessage("MultiAI: Extension UI state cleared.");
    },
    "multiai.openInTab": () => {
      provider?.createPanel();
    },
    "multiai.openInSideBar": async () => {
      await vscode.commands.executeCommand("multiai.webview.focus");
    },
    "multiai.focusInput": async () => {
      await vscode.commands.executeCommand("multiai.webview.focus");
      provider?.broadcast(Events.FocusInput, {});
    },
    "multiai.insertMention": async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showWarningMessage("No active editor");
        return;
      }
      await vscode.commands.executeCommand("multiai.webview.focus");
      if (!(await provider?.insertEditorMention(editor.document.uri, editor.selection))) {
        await vscode.window.showWarningMessage("The active file is outside the selected working directory.");
      }
    },
    "multiai.newConversation": async () => {
      await vscode.commands.executeCommand("multiai.webview.focus");
      provider?.broadcast(Events.NewConversation, {});
    },
    "multiai.showLogs": () => outputChannel?.show(),
    "multiai.reset": () => provider?.resetAllWebviews(),
    "multiai.logout": async () => {
      await vscode.commands.executeCommand("multiai.webview.focus");
      await vscode.window.showInformationMessage("Use the logout button in MultiAI settings.");
    },
  };

  for (const [id, handler] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }

  log("MultiAI CLI activated");
}

export async function deactivate(): Promise<void> {
  log("MultiAI CLI deactivating");
  await provider?.shutdown();
  provider = undefined;
}

function log(message: string): void {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function logError(message: string, error: unknown): void {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  log(`${message}: ${detail}`);
}

export { log };
