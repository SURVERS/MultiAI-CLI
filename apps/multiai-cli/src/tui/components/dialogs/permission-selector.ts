import type { PermissionMode } from '@multiai/sdk';

import { t } from '../../i18n';
import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

const PERMISSION_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'manual',
    label: t('Manual', 'Ручной'),
    description: t('Approve every action yourself.', 'Подтверждать каждое действие вручную.'),
  },
  {
    value: 'yolo',
    label: 'YOLO',
    description: t('Auto-approve tool actions, but the agent may still ask questions.', 'Автоматически подтверждать инструменты, но агент всё ещё может задавать вопросы.'),
  },
  {
    value: 'auto',
    label: t('Auto', 'Авто'),
    description: t('Fully autonomous — agent decides everything without asking.', 'Полная автономность — агент решает всё без вопросов.'),
  },
];

function isPermissionModeChoice(value: string): value is PermissionMode {
  return value === 'manual' || value === 'auto' || value === 'yolo';
}

export interface PermissionSelectorOptions {
  readonly currentValue: PermissionMode;
  readonly onSelect: (mode: PermissionMode) => void;
  readonly onCancel: () => void;
}

export class PermissionSelectorComponent extends ChoicePickerComponent {
  constructor(opts: PermissionSelectorOptions) {
    super({
      title: t('Select permission mode', 'Выберите режим разрешений'),
      options: [...PERMISSION_OPTIONS],
      currentValue: opts.currentValue,
      onSelect: (value) => {
        if (isPermissionModeChoice(value)) opts.onSelect(value);
      },
      onCancel: opts.onCancel,
    });
  }
}
