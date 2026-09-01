import { noActiveSessionMessage } from '../constant/multiai-tui';
import { t } from '../i18n';
import { ChoicePickerComponent } from '../components/dialogs/choice-picker';
import type { SlashCommandHost } from './dispatch';

type AddDirChoice = 'session' | 'remember' | 'cancel';

export async function handleAddDirCommand(host: SlashCommandHost, args: string): Promise<void> {
  const input = args.trim();
  const session = host.session;

  if (input.length === 0 || input.toLowerCase() === 'list') {
    const additionalDirs = session?.summary?.additionalDirs ?? [];
    if (additionalDirs.length === 0) {
      host.showStatus(t('No additional directories configured.', 'Дополнительные директории не настроены.'));
      return;
    }
    host.showStatus(formatAdditionalDirsStatus(additionalDirs));
    return;
  }

  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  host.mountEditorReplacement(
    new ChoicePickerComponent({
      title: t(`Add directory to workspace: ${input}`, `Добавить директорию в рабочую область: ${input}`),
      hint: t('↑↓ navigate · Enter confirm · Esc cancel', '↑↓ навигация · Enter подтвердить · Esc отменить'),
      options: [
        {
          value: 'session',
          label: t('Yes, for this session', 'Да, для этой сессии'),
        },
        {
          value: 'remember',
          label: t('Yes, and remember this directory', 'Да, и запомнить эту директорию'),
        },
        {
          value: 'cancel',
          label: t('No', 'Нет'),
        },
      ],
      onSelect: (value) => {
        void handleAddDirChoice(host, session.id, input, value as AddDirChoice);
      },
      onCancel: () => {
        host.restoreEditor();
        host.showStatus(t(`Did not add ${input} as a working directory.`, `${input} не добавлена как рабочая директория.`));
      },
    }),
  );
}

function formatAdditionalDirsStatus(additionalDirs: readonly string[]): string {
  return [t('Additional directories:', 'Дополнительные директории:'), ...additionalDirs.map((dir) => `  ${dir}`)].join('\n');
}

async function handleAddDirChoice(
  host: SlashCommandHost,
  sessionId: string,
  path: string,
  choice: AddDirChoice,
): Promise<void> {
  host.restoreEditor();

  if (choice === 'cancel') {
    host.showStatus(t(`Did not add ${path} as a working directory.`, `${path} не добавлена как рабочая директория.`));
    return;
  }

  const session = host.session;
  if (session === undefined || session.id !== sessionId) {
    host.showError(noActiveSessionMessage());
    return;
  }

  try {
    const result = await session.addAdditionalDir(path, { persist: choice === 'remember' });
    host.setAppState({ additionalDirs: result.additionalDirs });
    host.refreshSlashCommandAutocomplete();
    host.showStatus(
      choice === 'remember'
        ? t(
            `Added workspace directory:\n  ${path}\n  Saved to:\n  ${result.configPath}`,
            `Добавлена директория рабочей области:\n  ${path}\n  Сохранено в:\n  ${result.configPath}`,
          )
        : t(
            `Added workspace directory:\n  ${path}\n  For this session only`,
            `Добавлена директория рабочей области:\n  ${path}\n  Только для этой сессии`,
          ),
      'success',
    );
  } catch (error) {
    host.showError(error instanceof Error ? error.message : String(error));
  }
}
