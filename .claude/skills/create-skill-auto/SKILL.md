---
name: create-skill-auto
description: Autonomously create Claude Code skills — deduces all config from context, only asks what's strictly necessary. Use when creating new skills.
argument-hint: <what the skill should do>
disable-model-invocation: true
---

# Autonomous Skill Creator

Create a complete, well-structured Claude Code skill from a freeform description. Deduce everything possible. Only ask the user when genuinely ambiguous.

## Process

### 1. Analyze the request

From `$ARGUMENTS`, extract or infer:

- **Name**: derive from the description. Use lowercase-hyphenated format. Example: "a skill that reviews PRs" → `review-pr`
- **Description**: compress the user's intent into a clear, front-loaded sentence under 250 chars
- **Scope**: default to `project` (`.claude/skills/`). Use `personal` (`~/.claude/skills/`) only if the user explicitly says "for all projects" or "personal"
- **Invocation**:
  - If the skill has side effects, deploys, sends messages, or is destructive → `disable-model-invocation: true`
  - If the skill is background knowledge, conventions, or context → `user-invocable: false`
  - Otherwise → both (default, no field needed)
- **Arguments**: if the description implies parameterized input (e.g. "for a given file", "by issue number"), add `argument-hint` and use `$ARGUMENTS` in the content
- **Tool restrictions**: if the skill is read-only or exploratory → `allowed-tools: Read, Grep, Glob`. Otherwise omit (full access)
- **Execution context**: if the task is heavy, exploratory, or should be isolated → `context: fork` with appropriate `agent`. Otherwise inline
- **Instructions**: write clear, actionable steps based on what the user described

### 2. Decide what to ask

Only ask when you **cannot reasonably infer** the answer. Examples of when to ask:

- The description is too vague to write useful instructions (e.g. "make a skill for stuff")
- There's a genuine ambiguity about scope that context can't resolve
- The skill could reasonably work in two very different ways

Examples of when **NOT** to ask:

- Name — always derive from description
- Invocation control — apply the rules above
- Tool restrictions — default to unrestricted unless clearly read-only
- Supporting files — only add if the task genuinely needs templates/scripts
- Scope — default to project

If you need to ask, ask everything in a single message. Never ask more than 2 questions.

### 3. Create the skill

Generate the skill files directly. Do NOT show a "plan" or ask for confirmation unless the user's request was ambiguous (step 2).

#### File structure

```
.claude/skills/<skill-name>/
├── SKILL.md           # Always required
├── templates/         # Only if skill fills templates
├── scripts/           # Only if skill runs scripts
└── examples/          # Only if skill needs reference outputs
```

#### SKILL.md template

```yaml
---
name: <derived-name>
description: <compressed-description, max 250 chars>
# Only include fields that differ from defaults:
# argument-hint: <hint>              — only if skill takes arguments
# disable-model-invocation: true     — only if side effects
# user-invocable: false              — only if background knowledge
# allowed-tools: Read, Grep, Glob   — only if read-only
# context: fork                      — only if should be isolated
# agent: Explore                     — only if context: fork
# paths: "*.tsx"                     — only if file-type specific
---

<Clear, actionable instructions>
```

#### Writing rules

- Lead with the primary action
- Use numbered steps for procedures
- Use `$ARGUMENTS` for user input
- Use `${CLAUDE_SKILL_DIR}` to reference bundled files
- Keep under 500 lines — move details to supporting files
- Don't add fields that match defaults (no `user-invocable: true`, no `context: inline`)

### 4. Report

After creating, output a brief summary:

```
Skill created: /skill-name
Location: .claude/skills/skill-name/SKILL.md
Invocation: /skill-name [args]
```

Nothing more. No checklists, no "let me know if you want changes."
