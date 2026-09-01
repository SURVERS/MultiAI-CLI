import { t } from '#/tui/i18n';

import {
  StartPermissionPromptComponent,
  type StartPermissionOption,
} from './start-permission-prompt';

export type SwarmStartPermissionChoice = 'auto' | 'yolo' | 'manual';

export interface SwarmStartPermissionPromptOptions {
  readonly onSelect: (choice: SwarmStartPermissionChoice) => void;
  readonly onCancel: () => void;
}

const OPTIONS: readonly StartPermissionOption<SwarmStartPermissionChoice>[] = [
  {
    value: 'auto',
    label: t('Switch to Auto and start', 'Переключиться на Авто и начать'),
    description:
      t('Best for swarm tasks. Tools are approved automatically, and questions are skipped.', 'Лучший вариант для задач роя. Инструменты подтверждаются автоматически, а вопросы пропускаются.'),
  },
  {
    value: 'yolo',
    label: t('Switch to YOLO and start', 'Переключиться на YOLO и начать'),
    description:
      t('Tools and plan changes are approved automatically. MultiAI CLI may still ask you questions.', 'Инструменты и изменения плана подтверждаются автоматически. MultiAI CLI всё ещё может задавать вопросы.'),
  },
  {
    value: 'manual',
    label: t('Start in Manual', 'Начать в ручном режиме'),
    description:
      t('Keep approvals on. MultiAI CLI may stop and wait for you during the swarm task.', 'Оставить подтверждения включёнными. MultiAI CLI может остановиться и ждать вас во время задачи роя.'),
  },
];

const NOTICE_LINES = [
  t('Manual mode asks you before MultiAI CLI runs commands, edits files, or takes other risky actions.', 'В ручном режиме MultiAI CLI спрашивает разрешение перед запуском команд, изменением файлов и другими рискованными действиями.'),
  t('Manual mode can block swarm work while agents are running.', 'Ручной режим может заблокировать работу роя во время выполнения агентов.'),
  t('You can go back without losing your command.', 'Можно вернуться назад, не потеряв команду.'),
] as const;

export class SwarmStartPermissionPromptComponent extends StartPermissionPromptComponent<SwarmStartPermissionChoice> {
  constructor(opts: SwarmStartPermissionPromptOptions) {
    super({
      title: t('Start a swarm task with approvals on?', 'Начать задачу роя с подтверждениями?'),
      noticeLines: NOTICE_LINES,
      options: OPTIONS,
      onSelect: opts.onSelect,
      onCancel: opts.onCancel,
    });
  }
}
