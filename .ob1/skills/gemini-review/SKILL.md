---
name: gemini-review
description: Call Gemini CLI with Gemini 2.5 Pro in YOLO mode to perform a targeted code review
---

# Gemini Review Skill

This skill invokes the Gemini CLI with Gemini 2.5 Pro in YOLO mode to perform a targeted code review. The CLI explores the codebase itself.

## Usage

When this skill is activated, execute a code review using the Gemini CLI.

## Instructions

1. Determine the review target based on the user's prompt:
   - A specific file path
   - "the recent changes" (git diff)
   - A specific component or feature area

2. Run the Gemini CLI in YOLO mode with gemini-2.5-pro:

```bash
gemini -p --model gemini-2.5-pro --yolo "<user's review prompt>"
```

### Examples

**Review a specific file:**
```bash
gemini -p --model gemini-2.5-pro --yolo "Review frontend/js/crypto.js for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

**Review recent changes:**
```bash
gemini -p --model gemini-2.5-pro --yolo "Review the recent git changes for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

**Review a feature area:**
```bash
gemini -p --model gemini-2.5-pro --yolo "Review the backend Lambda functions for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

3. Present the output to the user

## Model

- **CLI:** `gemini`
- **Model:** `gemini-2.5-pro`
- **Mode:** `-p` (prompt/non-interactive)
- **Permissions:** `--yolo` (auto-approve all actions)
