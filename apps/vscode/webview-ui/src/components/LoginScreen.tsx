import { useState, useEffect } from "react";
import { IconLoader2, IconCopy, IconCheck, IconExternalLink, IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { bridge, Events } from "@/services";
import multiaiLogo from "@/assets/multiai-logo.svg";

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onSkip: () => void;
}

type LoginState = "idle" | "pending" | "error";

export function LoginScreen({ onLoginSuccess, onSkip }: LoginScreenProps) {
  const [state, setState] = useState<LoginState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return bridge.on<{ url: string }>(Events.LoginUrl, ({ url }) => {
      setUrl(url);
    });
  }, []);

  const handleLogin = async (
    method: "browser" | "device" = "browser",
    persistence: "keyring" | "session" = "keyring",
  ) => {
    setState("pending");
    setUrl(null);
    setError(null);
    try {
      const result = await bridge.login(method, persistence);
      if (result.success) {
        onLoginSuccess();
      } else {
        const errorMessage = result.error || "Login failed";
        setState("error");
        setError(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState("error");
      setError(errorMessage);
    }
  };

  const handleCopyUrl = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state === "pending") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <img src={multiaiLogo} alt="MultiAI CLI" className="size-12 mx-auto" />
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-blue-500">
              <IconLoader2 className="size-5 animate-spin" />
              <span className="text-sm font-medium">Waiting for authorization...</span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground text-left">A browser window should open automatically. Complete the sign-in process there.</p>
          </div>
          {url && (
            <div className="bg-muted/50 rounded-lg p-2 text-left space-y-3">
              <p className="text-xs text-muted-foreground">If the browser didn&apos;t open, visit this URL:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 font-mono break-all select-all">{url}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-8"
                  onClick={() => {
                    void handleCopyUrl();
                  }}
                >
                  {copied ? <IconCheck className="size-4 text-emerald-500" /> : <IconCopy className="size-4" />}
                </Button>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:underline">
                <IconExternalLink className="size-3.5" />
                Open in browser
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <img src={multiaiLogo} alt="MultiAI CLI" className="size-12 mx-auto" />
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Welcome to MultiAI CLI</h1>
            <div className="text-left space-y-2">
              <p className="text-xs leading-5">Sign in with your MultiAI account or use an existing provider configuration.</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2 text-left">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div className="text-left space-y-1">
              <Button
                onClick={() => {
                  void handleLogin("browser");
                }}
                className="w-full justify-center gap-2"
              >
                Sign in with MultiAI
              </Button>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void handleLogin("device")}>
                  Device code
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleLogin("browser", "session")}>
                  Session only
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-4">Browser login is the default. Device code works when loopback callbacks are unavailable.</p>
            </div>

            <div className="text-left space-y-1">
              <Button type="button" variant="outline" onClick={onSkip} className="w-full relative justify-center font-normal">
                <span>Skip</span>
                <IconArrowRight className="size-4 text-muted-foreground absolute right-3" />
              </Button>
              <p className="text-[11px] text-muted-foreground leading-4">Use your existing API key configuration.</p>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
