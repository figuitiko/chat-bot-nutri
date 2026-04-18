# Skill Registry — chat-bot (whatsapp-predefined-bot-backend)

Generated: 2026-04-16

## Project Skills

_No project-level skills detected (`.claude/skills/`, `.agent/skills/`)._

## User Skills

| Skill | Trigger Context | Path |
|-------|-----------------|------|
| `branch-pr` | Creating a pull request, preparing branch for review | `~/.claude/skills/branch-pr/SKILL.md` |
| `issue-creation` | Creating a GitHub issue, filing bug/feature reports | `~/.claude/skills/issue-creation/SKILL.md` |
| `judgment-day` | High-confidence adversarial code/architecture review before merging | `~/.claude/skills/judgment-day/SKILL.md` |
| `skill-creator` | Creating new AI agent skills, documenting project patterns | `~/.claude/skills/skill-creator/SKILL.md` |
| `go-testing` | Writing Go tests, using teatest, BubbleTea TUI testing | `~/.claude/skills/go-testing/SKILL.md` |

## Compact Rules

### branch-pr
- Always create branch before PR
- PR titles: `type(scope): description` (conventional commits)
- Link to issue in PR body
- Fill Summary + Test plan sections

### issue-creation
- Title: concise, actionable, problem-first
- Include steps to reproduce for bugs
- Include acceptance criteria for features

### judgment-day
- Launch two independent blind judge agents simultaneously
- Synthesize findings — only report HIGH confidence issues
- Apply fixes after synthesis

### skill-creator
- Frontmatter: `name`, `description`, `triggers`
- Keep skills focused and single-responsibility
- Include When to Use and explicit examples

## Convention Files

- No project-level CLAUDE.md, AGENTS.md, or .cursorrules detected

## Code Context Triggers

| File Pattern | Skills to Inject |
|--------------|-----------------|
| `*.ts`, `*.tsx` | _(none project-specific)_ |
| PR creation | `branch-pr` |
| Issue creation | `issue-creation` |
| Pre-merge review | `judgment-day` |
| New skill files | `skill-creator` |
