---
name: create-skill
description: Guide for creating new Claude Code skills. Use when the user asks to create, build, or set up a new skill. Validates requirements and asks for missing information before generating.
argument-hint: [skill-name] [description]
disable-model-invocation: true
---

# Create a New Claude Code Skill

You are a skill creation assistant. Follow this process to create a well-structured skill.

## Step 1: Gather Requirements

Before creating anything, ensure you have ALL of the following. If any are missing, ask the user:

| Requirement | Description | Required? |
|-------------|-------------|-----------|
| **Name** | Lowercase letters, numbers, hyphens only. Max 64 chars. | YES |
| **Description** | What the skill does and when to use it. Front-load the key use case. Max 250 chars recommended. | YES |
| **Scope** | Where to store it: `project` (`.claude/skills/`) or `personal` (`~/.claude/skills/`) | YES — default to `project` |
| **Invocation** | Who can invoke: `both` (default), `user-only` (`disable-model-invocation: true`), or `model-only` (`user-invocable: false`) | YES — ask if unclear |
| **Instructions** | What Claude should do when the skill runs | YES |
| **Arguments** | Does the skill accept arguments? If so, what? | Ask if the description suggests parameterized behavior |
| **Supporting files** | Does the skill need templates, scripts, examples, or reference docs? | Ask if the task is complex |
| **Tool restrictions** | Should Claude be limited to specific tools? (`allowed-tools`) | Ask if the skill should be read-only or restricted |
| **Execution context** | Should it run inline or in a subagent? (`context: fork`, `agent: Explore/Plan/general-purpose`) | Ask if the task is heavy or should be isolated |

**Only if you can't obtainit from the context, ask the user for anything not provided or implied by $ARGUMENTS.** For example, if they say "Create a skill that formats code," you might ask:
- "What should the skill be named? (e.g. `format-code`)"
- "Should this be a project skill or a personal skill?"
- "Who should be able to invoke this skill? Just you, just Claude, or both?"

## Step 2: Validate

Before generating files, confirm with the user:

1. Restate the skill's purpose in one sentence
2. Show the planned file structure
3. List the frontmatter fields you'll use
4. Ask: "Does this look right? Anything to change?"

Wait for confirmation before proceeding.

## Step 3: Create the Skill

### File structure

```
<scope-path>/skills/<skill-name>/
├── SKILL.md           # Main instructions (REQUIRED)
├── templates/         # Templates for Claude to fill (optional)
├── examples/          # Example outputs (optional)
├── scripts/           # Scripts Claude can execute (optional)
└── reference/         # Reference documentation (optional)
```

### SKILL.md format

```yaml
---
name: <skill-name>
description: <what it does and when to use it — max 250 chars>
# Optional fields (only include if needed):
# argument-hint: [arg1] [arg2]
# disable-model-invocation: true
# user-invocable: false
# allowed-tools: Read, Grep, Glob
# context: fork
# agent: Explore
# model: <model-id>
# effort: high
# paths: "*.tsx, *.ts"
---

<Skill instructions in markdown>
```

### Writing good instructions

- Lead with the primary action or purpose
- Use numbered steps for procedures
- Use `$ARGUMENTS` for user input (or `$0`, `$1` for positional args)
- Use `${CLAUDE_SKILL_DIR}` to reference files bundled with the skill
- Use `` !`command` `` for dynamic context injection (runs before Claude sees the content)
- Keep SKILL.md under 500 lines — move details to supporting files
- Reference supporting files with relative links so Claude knows they exist

### Frontmatter field reference

| Field | Purpose |
|-------|---------|
| `name` | Slash command name. Defaults to directory name if omitted |
| `description` | When Claude should use it. Front-load the key use case |
| `argument-hint` | Autocomplete hint, e.g. `[filename] [format]` |
| `disable-model-invocation` | `true` = only user can invoke via `/name` |
| `user-invocable` | `false` = hidden from `/` menu, only Claude invokes |
| `allowed-tools` | Restrict tools: `Read, Grep, Glob` = read-only |
| `context` | `fork` = run in isolated subagent |
| `agent` | Subagent type when `context: fork`: `Explore`, `Plan`, `general-purpose`, or custom agent name |
| `model` | Override model for this skill |
| `effort` | `low`, `medium`, `high`, `max` |
| `paths` | Glob patterns limiting auto-activation: `"*.py, src/**/*.ts"` |
| `hooks` | Lifecycle hooks scoped to this skill |
| `shell` | `bash` (default) or `powershell` |

### String substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed to the skill |
| `$ARGUMENTS[N]` or `$N` | Nth argument (0-based) |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_SKILL_DIR}` | Directory containing this SKILL.md |

## Step 4: Verify

After creating the skill, verify:

- [ ] SKILL.md exists in the correct location
- [ ] Frontmatter has `name` and `description`
- [ ] Description is under 250 characters
- [ ] Instructions are clear and actionable
- [ ] Supporting files (if any) are referenced from SKILL.md
- [ ] No hardcoded paths — uses `${CLAUDE_SKILL_DIR}` for bundled files
- [ ] Invocation control matches user's intent

Tell the user: "Skill created. Test it with `/skill-name` or ask Claude something that matches the description."
