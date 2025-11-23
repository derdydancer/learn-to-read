#!/bin/bash
# DeepSeek V3.1 with Claude Code

export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="sk-2f64831a77e44df2b8d9fc319fb41b75"
export ANTHROPIC_MODEL="deepseek-chat"
export ANTHROPIC_SMALL_FAST_MODEL="deepseek-chat"

# Launch Claude Code
claude "$@"