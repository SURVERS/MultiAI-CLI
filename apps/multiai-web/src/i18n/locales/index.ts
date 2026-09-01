import en_common from './en/common';
import en_app from './en/app';
import en_sidebar from './en/sidebar';
import en_workspace from './en/workspace';
import en_conversation from './en/conversation';
import en_status from './en/status';
import en_composer from './en/composer';
import en_login from './en/login';
import en_providers from './en/providers';
import en_model from './en/model';
import en_sessions from './en/sessions';
import en_approval from './en/approval';
import en_question from './en/question';
import en_tasks from './en/tasks';
import en_thinking from './en/thinking';
import en_diff from './en/diff';
import en_fileTree from './en/fileTree';
import en_filePreview from './en/filePreview';
import en_mention from './en/mention';
import en_warnings from './en/warnings';
import en_commands from './en/commands';
import en_tools from './en/tools';
import en_layout from './en/layout';
import en_mobile from './en/mobile';
import en_theme from './en/theme';

import ru_common from './ru/common';
import ru_app from './ru/app';
import ru_sidebar from './ru/sidebar';
import ru_workspace from './ru/workspace';
import ru_conversation from './ru/conversation';
import ru_status from './ru/status';
import ru_composer from './ru/composer';
import ru_login from './ru/login';
import ru_providers from './ru/providers';
import ru_model from './ru/model';
import ru_sessions from './ru/sessions';
import ru_approval from './ru/approval';
import ru_question from './ru/question';
import ru_tasks from './ru/tasks';
import ru_thinking from './ru/thinking';
import ru_diff from './ru/diff';
import ru_fileTree from './ru/fileTree';
import ru_filePreview from './ru/filePreview';
import ru_mention from './ru/mention';
import ru_warnings from './ru/warnings';
import ru_commands from './ru/commands';
import ru_tools from './ru/tools';
import ru_layout from './ru/layout';
import ru_mobile from './ru/mobile';
import ru_theme from './ru/theme';
import en_onboarding from './en/onboarding';
import ru_onboarding from './ru/onboarding';
import en_settings from './en/settings';
import ru_settings from './ru/settings';
import en_header from './en/header';
import ru_header from './ru/header';
import en_sideChat from './en/sideChat';
import ru_sideChat from './ru/sideChat';

export const messages = {
  en: {
    common: en_common,
    app: en_app,
    sidebar: en_sidebar,
    workspace: en_workspace,
    conversation: en_conversation,
    status: en_status,
    composer: en_composer,
    login: en_login,
    providers: en_providers,
    model: en_model,
    sessions: en_sessions,
    approval: en_approval,
    question: en_question,
    tasks: en_tasks,
    thinking: en_thinking,
    diff: en_diff,
    fileTree: en_fileTree,
    filePreview: en_filePreview,
    mention: en_mention,
    warnings: en_warnings,
    commands: en_commands,
    tools: en_tools,
    layout: en_layout,
    mobile: en_mobile,
    theme: en_theme,
    onboarding: en_onboarding,
    settings: en_settings,
    header: en_header,
    sideChat: en_sideChat,
  },
  ru: {
    common: ru_common,
    app: ru_app,
    sidebar: ru_sidebar,
    workspace: ru_workspace,
    conversation: ru_conversation,
    status: ru_status,
    composer: ru_composer,
    login: ru_login,
    providers: ru_providers,
    model: ru_model,
    sessions: ru_sessions,
    approval: ru_approval,
    question: ru_question,
    tasks: ru_tasks,
    thinking: ru_thinking,
    diff: ru_diff,
    fileTree: ru_fileTree,
    filePreview: ru_filePreview,
    mention: ru_mention,
    warnings: ru_warnings,
    commands: ru_commands,
    tools: ru_tools,
    layout: ru_layout,
    mobile: ru_mobile,
    theme: ru_theme,
    onboarding: ru_onboarding,
    settings: ru_settings,
    header: ru_header,
    sideChat: ru_sideChat,
  },
} as const;

export default messages;
