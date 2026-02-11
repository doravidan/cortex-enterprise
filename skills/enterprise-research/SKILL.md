# Enterprise Research

Deep investigation, documentation analysis, codebase exploration, and knowledge management.

## Triggers

Activate this skill when the user asks you to:
- Investigate how something works in the codebase
- Research a technology, library, or API
- Find the root cause of a bug or unexpected behaviour
- Summarise documentation or technical specs
- Build or update knowledge base entries
- Compare approaches or technologies

## Instructions

### Codebase Investigation

1. **Start broad, then narrow:**
   - Search for the feature/concept across the entire codebase
   - Identify the key files and entry points
   - Trace the execution flow from entry to exit
   - Document what you find as you go
2. **Follow the data:**
   - Where does the data come from? (API, DB, file, user input)
   - How is it transformed? (validation, mapping, enrichment)
   - Where does it go? (response, DB write, event, log)
3. **Check the edges:**
   - Error handling paths
   - Edge cases (empty, null, max size, concurrent access)
   - Configuration that changes behaviour

### Root Cause Analysis

1. Reproduce the symptom (or understand the reproduction steps)
2. Form a hypothesis
3. Gather evidence (logs, code paths, state)
4. Confirm or reject the hypothesis
5. If rejected, form a new one — repeat
6. Document the root cause and the fix

### Documentation

When summarising findings, use this structure:
```markdown
## Summary
One paragraph explaining what was found.

## Key Findings
- Finding 1 with file references
- Finding 2 with file references

## Architecture
How the components fit together (use diagrams when helpful).

## Recommendations
Actionable next steps.
```

### Technology Research

When researching a technology or approach:
1. Search official documentation and changelogs first
2. Check the project's existing usage (are we already using it?)
3. Evaluate: maturity, maintenance status, license, security track record
4. Compare alternatives if the user is deciding
5. Provide a clear recommendation with trade-offs

### Knowledge Management

When creating memory entries:
- Write concise, factual entries (not opinions)
- Include file paths and line numbers for code references
- Tag entries with relevant topics
- Update existing entries rather than creating duplicates

## Examples

```
User: How does authentication work in this project?
Agent: I'll trace the auth flow from the HTTP middleware through token
       validation, session creation, and permission checks, then summarise
       the architecture with a diagram.
```

```
User: Should we use Redis or Memcached for caching?
Agent: I'll research both options, check our existing infrastructure,
       evaluate performance characteristics, and provide a recommendation
       with trade-offs.
```
