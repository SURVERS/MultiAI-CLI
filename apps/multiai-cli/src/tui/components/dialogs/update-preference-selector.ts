import { t } from '../../i18n';
import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

const UPDATE_PREFERENCE_OPTIONS: readonly ChoiceOption[] = [
  {
    value: 'on',
    label: t('On', 'Включено'),
    description: t('Install new versions in the background.', 'Устанавливать новые версии в фоновом режиме.'),
  },
  {
    value: 'off',
    label: t('Off', 'Выключено'),
    description: t('Show the install prompt instead.', 'Вместо этого показывать запрос на установку.'),
  },
];

export interface UpdatePreferenceSelectorOptions {
  readonly currentValue: boolean;
  readonly onSelect: (value: boolean) => void;
  readonly onCancel: () => void;
}

export class UpdatePreferenceSelectorComponent extends ChoicePickerComponent {
  constructor(opts: UpdatePreferenceSelectorOptions) {
    super({
      title: t('Automatic updates', 'Автоматические обновления'),
      options: [...UPDATE_PREFERENCE_OPTIONS],
      currentValue: opts.currentValue ? 'on' : 'off',
      onSelect: (value) => {
        opts.onSelect(value === 'on');
      },
      onCancel: opts.onCancel,
    });
  }
}
