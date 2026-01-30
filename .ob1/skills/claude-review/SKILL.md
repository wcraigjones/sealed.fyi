---
name: claude-review
description: Call Claude CLI with Opus 4 in YOLO mode to perform a targeted code review
---

# Claude Review Skill

This skill invokes the Claude CLI with Opus 4 in YOLO mode to perform a targeted code review. The CLI explores the codebase itself.

## Usage

When this skill is activated, execute a code review using the Claude CLI.

## Instructions

1. Determine the review target based on the user's prompt:
   - A specific file path
   - "the recent changes" (git diff)
   - A specific component or feature area

2. Run the Claude CLI in YOLO mode with opus:

```bash
claude -p --model opus --dangerously-skip-permissions "<user's review prompt>"
```

### Examples

**Review a specific file:**
```bash
claude -p --model opus --dangerously-skip-permissions "Review frontend/js/crypto.js for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

**Review recent changes:**
```bash
claude -p --model opus --dangerously-skip-permissions "Review the recent git changes for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

**Review a feature area:**
```bash
claude -p --model opus --dangerously-skip-permissions "Review the backend Lambda functions for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

3. Present the output to the user

## Model

- **CLI:** `claude`
- **Model:** `opus` (Claude Opus 4)
- **Mode:** `-p` (print/non-interactive)
- **Permissions:** `--dangerously-skip-permissions` (YOLO mode - can read any files)
