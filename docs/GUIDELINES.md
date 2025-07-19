# Mile Quest Documentation Guidelines

## Purpose

This document provides clear procedures for maintaining and updating Mile Quest documentation, ensuring consistency and traceability across all agent work.

## Documentation Structure Overview

```
docs/agents/[agent-number]-[agent-name]/
├── current/              # 📌 Active documentation
├── versions/             # 📚 Historical versions
│   ├── v1.0/
│   ├── v2.0/
│   └── ...
├── working/              # 🚧 Work in progress
├── STATE.json            # Version and status tracking
└── CHANGELOG.md          # Change history
```

## Core Principles

1. **Single Source of Truth**: The `current/` folder always contains the active documentation
2. **Preserve History**: Never delete old versions, move them to `versions/`
3. **Work in Progress**: Use `working/` for drafts and incomplete changes
4. **Track Everything**: Update STATE.json and CHANGELOG.md with every change
5. **Cross-Reference**: Update MANIFEST.md when documentation structure changes

## When to Update Documentation

### Minor Updates (x.1 increment)
- Clarifications and corrections
- Adding examples
- Fixing typos
- Small refinements

**Process:**
1. Edit directly in `current/` folder
2. Update version in STATE.json (e.g., 2.0 → 2.1)
3. Add entry to CHANGELOG.md
4. No need to preserve old version

### Major Updates (x.0 increment)
- Architectural changes
- Significant redesigns
- Breaking changes
- New approaches

**Process:**
1. Copy entire `current/` folder to `versions/v[old-version]/`
2. Make changes in `current/` folder
3. Update version in STATE.json (e.g., 2.1 → 3.0)
4. Add detailed entry to CHANGELOG.md
5. Update MANIFEST.md
6. Update dependent documentation

### New Documentation
- New features
- New components
- Additional details

**Process:**
1. Create in `working/` folder first
2. Get review/approval if needed
3. Move to `current/` folder
4. Update STATE.json
5. Add to MANIFEST.md
6. Create CHANGELOG.md entry

## Step-by-Step Update Procedures

### 1. Starting Work on Documentation

```bash
# Check current state
cat docs/agents/[agent]/STATE.json
cat CLAUDE.md  # For context

# Create working copy if major changes
cp -r docs/agents/[agent]/current/* docs/agents/[agent]/working/
```

### 2. Making Changes

```bash
# Edit in working/ for major changes
# Edit in current/ for minor changes

# Add clear comments for significant changes
# @updated: 2025-01-12 - Added MVP simplifications
# @depends-on: Architecture v2.0
# @supersedes: complex-feature.md
```

### 3. Versioning Changes

#### Update STATE.json:
```json
{
  "agent": "Architecture",
  "currentVersion": "2.1",  // Increment version
  "previousVersion": "2.0",
  "status": "complete",
  "lastUpdated": "2025-01-12",
  "lastModifiedBy": "Architecture Agent",
  "activeDocuments": [
    "mvp-architecture.md",
    "infrastructure-diagram-mvp.md"
  ],
  "changes": "Added monitoring section, clarified database triggers"
}
```

#### Update CHANGELOG.md:
```markdown
## [2.1] - 2025-01-12
### Changed
- Added monitoring section to mvp-architecture.md
- Clarified database migration triggers
- Fixed cost calculations
### Dependencies
- No changes to dependent agents required
```

### 4. Preserving Old Versions (Major Changes Only)

```bash
# Create version folder
mkdir -p docs/agents/[agent]/versions/v2.0

# Copy current state
cp -r docs/agents/[agent]/current/* docs/agents/[agent]/versions/v2.0/

# Add VERSION file
echo "VERSION: 2.0" > docs/agents/[agent]/versions/v2.0/VERSION
echo "DEPRECATED: 2025-01-12" >> docs/agents/[agent]/versions/v2.0/VERSION
echo "SUPERSEDED BY: 3.0" >> docs/agents/[agent]/versions/v2.0/VERSION
```

### 5. Finalizing Changes

```bash
# For major changes, move from working/ to current/
mv docs/agents/[agent]/working/* docs/agents/[agent]/current/

# Update manifest
# Edit docs/MANIFEST.md to reflect new versions

# Update main context
# Edit CLAUDE.md if significant changes

# Commit with clear message
git add .
git commit -m "docs: Update [Agent] to v[X.Y] - [brief description]"
```

## Documentation Standards

### File Naming
- Use lowercase with hyphens: `mvp-architecture.md`
- Be descriptive: `infrastructure-diagram-mvp.md` not `diagram2.md`
- Include version in filename if needed: `schema-v2.md`

### Document Headers
Every document should start with:
```markdown
# [Document Title]

**Version**: 2.0  
**Status**: Current  
**Last Updated**: 2025-01-12  
**Agent**: Architecture Agent  
**Dependencies**: UI/UX v2.0, Data Model v1.0  

## Overview
[Brief description of document purpose]
```

### Tagging System
Use tags to help Claude understand document relationships:
- `@current` - This is the active version
- `@superseded-by: [filename]` - Points to newer version
- `@depends-on: [agent/version]` - Shows dependencies
- `@update-with: [agent]` - Which agent should update this
- `@breaking-change` - Indicates major changes

### Cross-References
When referencing other documents:
```markdown
See [MVP Architecture](../01-architecture/current/mvp-architecture.md) for details.
```

## Review Process

### Self-Review Checklist
Before finalizing documentation updates:
- [ ] Version number updated in STATE.json
- [ ] CHANGELOG.md entry added
- [ ] MANIFEST.md updated (if needed)
- [ ] Dependencies checked and noted
- [ ] Old version preserved (if major change)
- [ ] Cross-references updated
- [ ] Headers include version and date

### Peer Review (When Applicable)
For major changes affecting multiple agents:
1. Create in `working/` folder
2. Request review via PR comment
3. Address feedback
4. Move to `current/` after approval

## Common Scenarios

### Scenario 1: Fixing a Typo
1. Edit directly in `current/`
2. No version change needed
3. Commit with message: "fix: Typo in [file]"

### Scenario 2: Adding a Section
1. Edit in `current/`
2. Increment minor version (2.0 → 2.1)
3. Update STATE.json and CHANGELOG.md
4. Commit with message: "docs: Add [section] to [agent]"

### Scenario 3: Major Redesign
1. Copy `current/` to `versions/v2.0/`
2. Work in `working/` folder
3. Review and finalize
4. Move to `current/`
5. Increment major version (2.x → 3.0)
6. Update all tracking files
7. Update dependent documentation

### Scenario 4: Deprecating a Feature
1. Move affected docs to `versions/deprecated/`
2. Add DEPRECATED.md with explanation
3. Update active docs to remove references
4. Update MANIFEST.md

## Quick Reference Commands

```bash
# Check what needs updating
grep -r "@update-with: YourAgent" docs/

# Find dependencies
grep -r "@depends-on:" docs/agents/[agent]/current/

# Check version status
cat docs/agents/*/STATE.json | grep currentVersion

# Find superseded documents
find docs -name "*.md" -exec grep -l "@superseded-by" {} \;
```

## Troubleshooting

### Conflicting Versions
If two agents have conflicting information:
1. Check STATE.json for latest versions
2. Review CHANGELOG.md for recent changes
3. Consult MANIFEST.md for current status
4. Use Review & Enhancement Agent if needed

### Lost Documentation
If documentation seems missing:
1. Check `versions/` folders
2. Review git history
3. Check MANIFEST.md for relocations
4. Look in `working/` for incomplete work

### Unclear Dependencies
To trace dependencies:
1. Search for `@depends-on` tags
2. Check STATE.json dependencies field
3. Review CHANGELOG.md for breaking changes
4. Consult integration documents

## CSS and Styling Guidelines

### CSS Architecture

Mile Quest follows a **Tailwind CSS + CSS Modules** hybrid approach:

1. **Use Tailwind CSS for 90% of styling needs**
   - Layout, spacing, typography, colors
   - Responsive design with mobile-first approach
   - State modifiers (hover, focus, active)
   - Simple animations and transitions

2. **Use CSS Modules only when necessary (10%)**
   - Complex keyframe animations
   - Third-party component overrides
   - Styles that cannot be expressed with utilities

### CSS Best Practices

1. **Component Styling Pattern**
   ```tsx
   // Use composable className patterns
   const baseClasses = 'font-semibold rounded-lg';
   const sizeClasses = { sm: 'px-4 py-2', md: 'px-6 py-3' };
   const variantClasses = { primary: 'bg-primary text-white' };
   ```

2. **Mobile-First Responsive Design**
   ```tsx
   // Start with mobile, add breakpoints for larger screens
   className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
   ```

3. **Performance Guidelines**
   - Keep initial CSS < 20KB compressed
   - Use CSS containment for complex components
   - Avoid runtime CSS-in-JS libraries

4. **File Organization**
   - Global styles in `app/globals.css`
   - Component styles co-located with components
   - Shared animations in `styles/animations.css`

### CSS Documentation

When documenting CSS decisions:
1. Update `/docs/CSS-ARCHITECTURE.md` for architectural changes
2. Include CSS examples in component documentation
3. Document any custom utility classes
4. Note performance implications of CSS choices

See the full [CSS Architecture Guidelines](/docs/CSS-ARCHITECTURE.md) for detailed patterns and examples.

---

**Remember**: Good documentation is a living system. Keep it current, clear, and connected.

**Last Updated**: 2025-01-19