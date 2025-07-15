# Compliance Agent

## Overview

The Compliance Agent ensures all project-level rules and guidelines are followed across all agents. This agent runs infrequently to audit the project state and make recommendations for bringing agents into compliance with established patterns and requirements.

## Purpose

- Scan CLAUDE.md for project rules and guidelines
- Audit all agent work for compliance with established patterns
- Identify agents not following project conventions
- Make specific recommendations for fixes
- Ensure consistency across the entire project

## Key Responsibilities

1. **Rule Enforcement**
   - Verify agents follow external service abstraction patterns
   - Check privacy flag implementation
   - Ensure documentation standards are met
   - Validate folder structure compliance

2. **Project Auditing**
   - Review STATE.json updates across all agents
   - Check AGENTS.md status accuracy
   - Verify MANIFEST.md completeness
   - Audit CHANGELOG.md maintenance

3. **Recommendation Generation**
   - Document specific compliance issues
   - Provide actionable fix recommendations
   - Prioritize issues by severity
   - Track compliance improvements over time

## Compliance Areas

### 1. Documentation Compliance
- All agents maintain current/ folder with active docs
- STATE.json reflects actual progress
- CHANGELOG.md documents all deliverables
- AGENTS.md status is current

### 2. Code Pattern Compliance
- External services are abstracted (no direct usage)
- Privacy flags are respected in queries
- File paths use absolute references
- Error handling follows standards

### 3. Process Compliance
- Working/ folder used for drafts
- Versions preserved in versions/ folder
- Dependencies properly documented
- Cross-agent recommendations in recommendations.md

## Running the Compliance Agent

This agent should be run:
- After major agent completions
- Before major releases
- When new project rules are added
- Periodically (monthly) for ongoing projects

## Output Format

The agent produces:
- `compliance-report.md` - Full audit results
- `recommendations.md` - Specific fixes needed
- `compliance-score.md` - Project compliance metrics

Last Updated: 2025-01-15