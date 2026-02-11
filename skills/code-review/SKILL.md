# Code Review

Expert code review, refactoring guidance, and PR management for enterprise codebases.

## Triggers

Activate this skill when the user asks you to:
- Review code, a diff, or a pull request
- Refactor or improve existing code
- Check code quality, style, or best practices
- Create or update a pull request
- Run tests and analyse results

## Instructions

### Reviewing Code

1. **Read the full context** before commenting.  Understand what the code does, not just how it looks.
2. **Check these dimensions in order:**
   - Correctness — does it do what it's supposed to?
   - Security — any injection, auth bypass, secret leak?
   - Performance — O(n²) loops, unnecessary allocations, missing indexes?
   - Readability — clear names, small functions, minimal nesting?
   - Tests — are edge cases covered?  Are assertions meaningful?
3. **Classify every finding:**
   - `🔴 BLOCKER` — must fix before merge (bugs, security holes)
   - `🟡 SUGGESTION` — should fix (perf, readability, maintainability)
   - `🟢 NIT` — optional style preference
4. **Provide the fix**, not just the problem.  Show a code snippet for every blocker.

### Refactoring

1. Explain *why* the refactor improves the code (maintainability, testability, perf).
2. Make the smallest change that achieves the goal — don't rewrite unrelated code.
3. Ensure all existing tests still pass after the refactor.
4. If the refactor is large, break it into reviewable commits.

### Pull Requests

When creating PRs:
```
## Summary
- One-line description of what changed and why

## Changes
- Bullet list of key changes

## Test Plan
- How to verify the changes work

## Security Checklist
- [ ] No secrets committed
- [ ] Input validation present
- [ ] Auth checks in place
```

### Language-Specific Checks

**JavaScript / TypeScript:**
- Prefer `const` over `let`; never `var`
- Use `===` over `==`
- Handle Promise rejections (`.catch` or try/catch with await)
- Check for prototype pollution in object merges

**Java:**
- Close resources (use try-with-resources)
- Check null safety
- Validate input at API boundaries
- Use parameterised queries — never string concatenation for SQL

**CDS (SAP CAP):**
- Validate entity associations
- Check `@requires` / `@restrict` annotations
- Ensure proper error handling in custom handlers

**Python:**
- Use type hints
- Handle exceptions explicitly (no bare `except:`)
- Use context managers for I/O

## Examples

```
User: Review this function
Agent: I'll analyse the function across correctness, security, performance,
       and readability, then provide classified findings with fixes.
```

```
User: Create a PR for my changes
Agent: I'll review the diff, draft a summary with test plan, and create
       the pull request via `gh pr create`.
```
