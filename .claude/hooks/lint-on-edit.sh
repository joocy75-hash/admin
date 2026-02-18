#!/bin/bash
# Auto-lint after file edits
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Python files: check syntax
if [[ "$FILE_PATH" == *.py ]]; then
  python3 -c "import ast; ast.parse(open('$FILE_PATH').read())" 2>&1
  if [ $? -ne 0 ]; then
    echo "Python syntax error in $FILE_PATH" >&2
    exit 2
  fi
fi

# TypeScript/JavaScript: basic check
if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx || "$FILE_PATH" == *.js || "$FILE_PATH" == *.jsx ]]; then
  if command -v npx &>/dev/null && [ -f "$(dirname "$FILE_PATH")/../../node_modules/.bin/tsc" ]; then
    # Only report, don't block
    echo "{\"systemMessage\": \"File edited: $FILE_PATH - consider running type check\"}"
    exit 0
  fi
fi

exit 0
