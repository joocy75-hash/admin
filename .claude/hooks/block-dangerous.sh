#!/bin/bash
# Block dangerous bash commands
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "drop database"
  "DROP DATABASE"
  "truncate"
  "TRUNCATE"
  "docker system prune -a"
  "git push --force"
  "git reset --hard"
  "> /dev/sda"
  "mkfs"
  ":(){:|:&};:"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    jq -n --arg reason "Blocked: '$pattern' detected. Confirm with user first." '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }'
    exit 0
  fi
done

exit 0
