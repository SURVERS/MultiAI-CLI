import type { TuiLanguage } from '../../i18n';
import { t } from '../../i18n';
import { ChoicePickerComponent } from './choice-picker';

export interface LanguageSelectorOptions {
  readonly current: TuiLanguage;
  readonly onSelect: (language: TuiLanguage) => void;
  readonly onCancel: () => void;
}

export class LanguageSelectorComponent extends ChoicePickerComponent {
  constructor(options: LanguageSelectorOptions) {
    super({
      title: t('Language', 'Язык'),
      options: [
        {
          value: 'ru',
          label: 'Русский',
          description: t('Use the Russian interface.', 'Использовать русский интерфейс.'),
        },
        {
          value: 'en',
          label: t('English', 'Английский'),
          description: t('Use the English interface.', 'Использовать английский интерфейс.'),
        },
      ],
      currentValue: options.current,
      onSelect: (value) => {
        if (value === 'en' || value === 'ru') options.onSelect(value);
      },
      onCancel: options.onCancel,
    });
  }
}
