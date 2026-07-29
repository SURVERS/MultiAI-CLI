import * as vscode from "vscode";
import type { MultiAIHarness } from "@multiai/sdk";

export async function updateLoginContext(harness: MultiAIHarness): Promise<boolean> {
  const status = await harness.auth.status();
  const loggedIn = status.loggedIn;
  await vscode.commands.executeCommand("setContext", "multiai.isLoggedIn", loggedIn);
  return loggedIn;
}
