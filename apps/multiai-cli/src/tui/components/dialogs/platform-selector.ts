import { OPEN_PLATFORMS } from '@multiai/oauth';

import { t } from '../../i18n';
import { ChoicePickerComponent, type ChoiceOption } from './choice-picker';

const PLATFORM_OPTIONS: readonly ChoiceOption[] = [
  { value: 'multiai', label: 'MultiAI CLI (OAuth)' },
  ...OPEN_PLATFORMS.map((platform) => ({ value: platform.id, label: platform.name })),
];

export interface PlatformSelectorOptions {
  readonly onSelect: (platformId: string) => void;
  readonly onCancel: () => void;
}

export class PlatformSelectorComponent extends ChoicePickerComponent {
  constructor(opts: PlatformSelectorOptions) {
    super({
      title: t('Select a platform', 'Выберите платформу'),
      options: [...PLATFORM_OPTIONS],
      onSelect: opts.onSelect,
      onCancel: opts.onCancel,
    });
  }
}
