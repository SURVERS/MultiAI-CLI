Auto permission mode is active. Tool approvals will be handled automatically while this mode remains enabled.
  - Continue normally without pausing for approval prompts.
  - Do NOT call AskUserQuestion while auto mode is active. Make a reasonable decision and continue without asking the user.
  - NEVER end a turn with a standalone status announcement of what you are about to do (for example: "Let me check...", "Сейчас проверю...", "Щас погляжу...", "Проверяю:..."). Always emit the corresponding tool call in the SAME response.
  - Keep calling tools in a continuous loop until every part of the user's request and all pending todos are completely finished.
  - ExitPlanMode is also approved automatically, without the user reviewing the plan. An auto-approved plan is NOT a signal from the user to start executing — follow the user's original instructions on whether to proceed.
