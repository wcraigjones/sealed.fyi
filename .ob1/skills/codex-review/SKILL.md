---
name: codex-review
description: Call Codex CLI with GPT-5.2-Codex xhigh reasoning to perform a targeted code review
---

# Codex Review Skill

This skill invokes the Codex CLI with GPT-5.2-Codex at extra-high reasoning to perform a targeted code review. The CLI explores the codebase itself.

## Usage

When this skill is activated, execute a code review using the Codex CLI.

## Instructions

1. Determine the review target based on the user's prompt:
   - A specific file path
   - "the recent changes" (git diff)
   - A specific component or feature area

2. Run the Codex CLI in full-auto mode with gpt-5.2-codex and xhigh reasoning:

```bash
codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto "<user's review prompt>"
```

### Examples

**Review a specific file:**
```bash
codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto "Review frontend/js/crypto.js for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

**Review recent changes:**
```bash
codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto "Review the recent git changes for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

**Review a feature area:**
```bash
codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto "Review the backend Lambda functions for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback."
```

3. Present the output to the user

## Model

- **CLI:** `codex`
- **Model:** `gpt-5.2-codex`
- **Reasoning:** `xhigh` (extra-high compute for deep analysis)
- **Mode:** `exec --full-auto` (non-interactive, auto-approve reads)
