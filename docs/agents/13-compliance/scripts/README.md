# Compliance Agent Scripts

This directory contains automated scripts for checking Mile Quest project compliance.

## Available Scripts

### compliance-checker.js
Node.js implementation of the automated compliance checker.

**Usage:**
```bash
cd docs/agents/13-compliance/scripts
node compliance-checker.js
```

### compliance-checker.py
Python implementation of the automated compliance checker.

**Usage:**
```bash
cd docs/agents/13-compliance/scripts
python3 compliance-checker.py
```

## What the Scripts Check

Both scripts perform identical compliance checks:

1. **Documentation Structure** - Verifies required folders and files exist
2. **STATE.json Format** - Validates required fields and values
3. **Project Updates** - Checks AGENTS.md, MANIFEST.md, and CLAUDE.md updates
4. **Backlog Format** - Validates backlog.json structure and fields

## Output

The scripts generate:
- Console report with scores and violations
- Detailed JSON report saved to `current/automated-compliance-report.json`

## Integration with Compliance Audits

When running the Compliance Agent, these scripts should be executed first to provide automated checking before manual review. The results can be incorporated into the main compliance audit report.

## Requirements

- **Node.js script**: Requires Node.js 12+ (uses built-in fs and path modules)
- **Python script**: Requires Python 3.6+ (uses standard library only)