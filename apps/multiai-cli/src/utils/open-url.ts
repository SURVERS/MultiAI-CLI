import { execFile } from 'node:child_process';

export function openUrl(url: string): void {
  const command: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  execFile(command[0], command[1], () => {});
}
