import { t } from '#/tui/i18n';

import {
  StartPermissionPromptComponent,
  type StartPermissionOption,
} from './start-permission-prompt';

export type GoalStartPermissionChoice = 'auto' | 'yolo' | 'manual' | 'cancel';

export interface GoalStartPermissionPromptOptions {
  readonly mode: 'manual' | 'yolo';
  readonly onSelect: (choice: GoalStartPermissionChoice) => void;
  readonly onCancel: () => void;
}

export const GOAL_START_MANUAL_OPTIONS: readonly StartPermissionOption[] = [
  {
    value: 'auto',
    label: t('Switch to Auto and start', 'Переключиться на Авто и начать'),
    description:
      t('Best if you want MultiAI CLI to keep working while you are away. Tools are approved automatically, and questions are skipped.', 'Лучший вариант для работы MultiAI CLI без вашего участия. Инструменты подтверждаются автоматически, а вопросы пропускаются.'),
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
      t('Keep approvals on. MultiAI CLI will ask before risky actions, so the goal may stop and wait for you.', 'Оставить подтверждения включёнными. MultiAI CLI спросит перед рискованными действиями, поэтому выполнение цели может остановиться и ждать вас.'),
  },
  {
    value: 'cancel',
    label: t('Do not start', 'Не начинать'),
    description: t('Return to the input box with your goal command.', 'Вернуться к полю ввода с командой цели.'),
  },
];

export const GOAL_START_YOLO_OPTIONS: readonly StartPermissionOption[] = [
  {
    value: 'auto',
    label: t('Switch to Auto and start', 'Переключиться на Авто и начать'),
    description:
      t('Best if you want MultiAI CLI to keep working while you are away. Tools are approved automatically, and questions are skipped.', 'Лучший вариант для работы MultiAI CLI без вашего участия. Инструменты подтверждаются автоматически, а вопросы пропускаются.'),
  },
  {
    value: 'yolo',
    label: t('Keep YOLO and start', 'Оставить YOLO и начать'),
    description:
      t('Tools and plan changes stay approved automatically. MultiAI CLI may still ask you questions.', 'Инструменты и изменения плана останутся автоматически подтверждёнными. MultiAI CLI всё ещё может задавать вопросы.'),
  },
  {
    value: 'cancel',
    label: t('Do not start', 'Не начинать'),
    description: t('Return to the input box with your goal command.', 'Вернуться к полю ввода с командой цели.'),
  },
];

export function goalStartOptions(mode: 'manual' | 'yolo'): readonly StartPermissionOption[] {
  return mode === 'yolo' ? GOAL_START_YOLO_OPTIONS : GOAL_START_MANUAL_OPTIONS;
}

const MANUAL_OPTIONS = GOAL_START_MANUAL_OPTIONS;

const YOLO_OPTIONS = GOAL_START_YOLO_OPTIONS;

const MANUAL_NOTICE_LINES = [
  t('Manual mode asks you before MultiAI CLI runs commands, edits files, or takes other risky actions.', 'В ручном режиме MultiAI CLI спрашивает разрешение перед запуском команд, изменением файлов и другими рискованными действиями.'),
  t('Manual mode is not suitable for unattended goal work.', 'Ручной режим не подходит для выполнения цели без вашего участия.'),
  t('You can go back without losing your command.', 'Можно вернуться назад, не потеряв команду.'),
] as const;

const YOLO_NOTICE_LINES = [
  t('YOLO mode approves tools and plan changes automatically.', 'Режим YOLO автоматически подтверждает инструменты и изменения плана.'),
  t('YOLO mode can still stop for questions.', 'Режим YOLO всё ещё может останавливаться для вопросов.'),
  t('Switch to Auto if you want questions skipped during goal work.', 'Переключитесь на Авто, чтобы пропускать вопросы во время выполнения цели.'),
] as const;

export class GoalStartPermissionPromptComponent extends StartPermissionPromptComponent {
  constructor(opts: GoalStartPermissionPromptOptions) {
    super({
      title:
        opts.mode === 'yolo'
          ? t('Start a goal in YOLO mode?', 'Начать выполнение цели в режиме YOLO?')
          : t('Start a goal with approvals on?', 'Начать выполнение цели с подтверждениями?'),
      noticeLines: opts.mode === 'yolo' ? YOLO_NOTICE_LINES : MANUAL_NOTICE_LINES,
      options: opts.mode === 'yolo' ? YOLO_OPTIONS : MANUAL_OPTIONS,
      onSelect: opts.onSelect,
      onCancel: opts.onCancel,
    });
  }
}
