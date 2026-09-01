import { Container, Spacer } from '@multiai/pi-tui';

import type { MoonLoader } from '#/tui/components/chrome/moon-loader';
import { t } from '#/tui/i18n';

export type ActivityPaneMode = 'hidden' | 'waiting' | 'thinking' | 'composing' | 'tool';

export interface ActivityPaneOptions {
  readonly mode: ActivityPaneMode;
  readonly spinner?: MoonLoader;
  readonly tip?: string;
}

export class ActivityPaneComponent extends Container {
  private spinnerRef?: MoonLoader;

  constructor(options: ActivityPaneOptions) {
    super();
    this.spinnerRef = options.spinner;

    if (
      (options.mode === 'waiting' || options.mode === 'tool' || options.mode === 'composing') &&
      options.spinner !== undefined
    ) {
      this.addChild(new Spacer(1));
      if (options.tip) {
        options.spinner.setTip(` · ${t('Tip', 'Совет')}: ${options.tip}`);
      }
      this.addChild(options.spinner);
    }
  }

  override render(width: number): string[] {
    if (this.spinnerRef && 'setAvailableWidth' in this.spinnerRef) {
      this.spinnerRef.setAvailableWidth(width);
    }
    return super.render(width);
  }
}
