---
name: mega-review
description: Call Claude (Opus 4), Codex (GPT-5.2-Codex xhigh), and Gemini (2.5 Pro) CLIs in parallel with full permissions to perform a comprehensive code review, then compile the feedback
---

# Mega Review Skill

This skill invokes all three AI CLIs in parallel with full permissions to perform a comprehensive code review. Each CLI explores the codebase itself. Results are compiled and synthesized.

## Usage

When this skill is activated, execute a multi-model code review. The user provides a shared prompt such as:
- "review this file: frontend/js/crypto.js"
- "review the recent changes"
- "review the crypto implementation"

## Instructions

### Step 1: Construct the Review Prompt

Based on the user's request, construct a clear review prompt. For example:

```
Review <target> for security vulnerabilities, bugs, performance issues, and best practices. Provide specific, actionable feedback.
```

### Step 2: Call All Three CLIs in Parallel

Execute all three reviews concurrently:

```bash
REVIEW_DIR=$(mktemp -d)
REVIEW_PROMPT="<constructed prompt from user's request>"

# Claude Opus 4 (YOLO mode)
claude -p --model opus --dangerously-skip-permissions "$REVIEW_PROMPT" > "$REVIEW_DIR/claude.txt" 2>&1 &
CLAUDE_PID=$!

# Codex GPT-5.2-Codex xhigh (full-auto mode)
codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto "$REVIEW_PROMPT" > "$REVIEW_DIR/codex.txt" 2>&1 &
CODEX_PID=$!

# Gemini 2.5 Pro (YOLO mode)
gemini -p --model gemini-2.5-pro --yolo "$REVIEW_PROMPT" > "$REVIEW_DIR/gemini.txt" 2>&1 &
GEMINI_PID=$!

# Wait for all to complete
wait $CLAUDE_PID $CODEX_PID $GEMINI_PID
```

### Step 3: Compile and Present Results

Read all outputs and present in a structured format:

```markdown
# Mega Review Results

## 🟣 Claude Opus 4 Review
[Content from $REVIEW_DIR/claude.txt]

---

## 🟢 Codex GPT-5.2-Codex (xhigh) Review
[Content from $REVIEW_DIR/codex.txt]

---

## 🔵 Gemini 2.5 Pro Review
[Content from $REVIEW_DIR/gemini.txt]

---

## 📊 Synthesized Summary

### Critical Issues (flagged by multiple models)
- [Issues mentioned by 2+ models — highest priority]

### Security Concerns
- [Consolidated security feedback]

### Performance Recommendations
- [Consolidated performance feedback]

### Code Quality Suggestions
- [Consolidated style/quality feedback]

### Unique Insights
- **Claude:** [Unique observation]
- **Codex:** [Unique observation]
- **Gemini:** [Unique observation]
```

### Step 4: Clean Up

```bash
rm -rf "$REVIEW_DIR"
```

## CLIs Used

| CLI | Model | Command |
|-----|-------|---------|
| `claude` | opus | `claude -p --model opus --dangerously-skip-permissions "<prompt>"` |
| `codex` | gpt-5.2-codex (xhigh) | `codex exec --model gpt-5.2-codex --config model_reasoning_effort="xhigh" --full-auto "<prompt>"` |
| `gemini` | gemini-2.5-pro | `gemini -p --model gemini-2.5-pro --yolo "<prompt>"` |

## Tips

- Issues flagged by multiple models should be prioritized
- Each model has different strengths — unique insights are valuable
- All CLIs run with full permissions and explore the codebase themselves
- The synthesized summary is the most actionable output
