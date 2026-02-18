#!/bin/bash
# macOS notification when Claude finishes a task
INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

if [ "$STOP_HOOK_ACTIVE" = "false" ]; then
  osascript -e 'display notification "Claude Code 작업이 완료되었습니다" with title "Claude Code" sound name "Glass"' 2>/dev/null || true
fi

exit 0
