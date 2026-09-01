import { t } from '../../i18n';
import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

export type SettingsSelection =
  | 'model'
  | 'language'
  | 'theme'
  | 'editor'
  | 'permission'
  | 'experiments'
  | 'upgrade'
  | 'usage';

const SETTINGS_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'model',
    label: t('Model', 'Модель'),
    description: t('Switch the active model and thinking mode.', 'Сменить активную модель и режим размышлений.'),
  },
  {
    value: 'language',
    label: t('Language', 'Язык'),
    description: t('Change the terminal interface language.', 'Сменить язык интерфейса терминала.'),
  },
  {
    value: 'permission',
    label: t('Permission', 'Разрешения'),
    description: t('Choose how tool actions are approved.', 'Настроить подтверждение действий инструментов.'),
  },
  {
    value: 'theme',
    label: t('Theme', 'Тема'),
    description: t('Change the terminal UI theme.', 'Сменить тему интерфейса терминала.'),
  },
  {
    value: 'editor',
    label: t('Editor', 'Редактор'),
    description: t('Set the external editor command.', 'Настроить команду внешнего редактора.'),
  },
  {
    value: 'experiments',
    label: t('Experiments', 'Эксперименты'),
    description: t('Turn experimental features on or off.', 'Включить или выключить экспериментальные функции.'),
  },
  {
    value: 'upgrade',
    label: t('Automatic updates', 'Автоматические обновления'),
    description: t('Turn automatic CLI updates on or off.', 'Включить или выключить автоматические обновления CLI.'),
  },
  {
    value: 'usage',
    label: t('Usage', 'Использование'),
    description: t('Show session tokens, context window, and plan quotas.', 'Показать токены сессии, окно контекста и квоты плана.'),
  },
];

function isSettingsSelection(value: string): value is SettingsSelection {
  return (
    value === 'model' ||
    value === 'language' ||
    value === 'theme' ||
    value === 'editor' ||
    value === 'permission' ||
    value === 'experiments' ||
    value === 'upgrade' ||
    value === 'usage'
  );
}

export interface SettingsSelectorOptions {
  readonly onSelect: (value: SettingsSelection) => void;
  readonly onCancel: () => void;
}

export class SettingsSelectorComponent extends ChoicePickerComponent {
  constructor(opts: SettingsSelectorOptions) {
    super({
      title: t('Settings', 'Настройки'),
      options: [...SETTINGS_OPTIONS],
      onSelect: (value) => {
        if (isSettingsSelection(value)) opts.onSelect(value);
      },
      onCancel: opts.onCancel,
    });
  }
}
