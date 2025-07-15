#!/usr/bin/env python3

"""
Mile Quest Automated Compliance Checker (Python Version)

This script automatically verifies project compliance with rules defined in CLAUDE.md
Run this script as part of regular compliance audits.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent
AGENTS_DIR = PROJECT_ROOT / "docs" / "agents"
CLAUDE_MD = PROJECT_ROOT / "CLAUDE.md"
AGENTS_MD = PROJECT_ROOT / "AGENTS.md"
MANIFEST_MD = PROJECT_ROOT / "docs" / "MANIFEST.md"

class ComplianceChecker:
    def __init__(self):
        self.results = {
            "agents": {},
            "summary": {
                "totalAgents": 0,
                "totalScore": 0,
                "violations": []
            }
        }
    
    def check_documentation_structure(self, agent_path: Path, agent_name: str) -> Dict:
        """Check if agent has required folder structure and files."""
        required_items = {
            "current": agent_path / "current",
            "working": agent_path / "working",
            "versions": agent_path / "versions",
            "stateJson": agent_path / "STATE.json",
            "changelog": agent_path / "CHANGELOG.md",
            "backlog": agent_path / "backlog.json"
        }
        
        score = {}
        violations = []
        
        for item_name, item_path in required_items.items():
            exists = item_path.exists()
            score[item_name] = 1 if exists else 0
            if not exists:
                if item_name.endswith("Json") or item_name.endswith("log"):
                    violations.append(f"Missing {item_path.name}")
                else:
                    violations.append(f"Missing {item_name}/ folder")
        
        total_score = sum(score.values())
        return {
            "score": (total_score / len(required_items)) * 100,
            "violations": violations,
            "details": score
        }
    
    def check_state_json_format(self, agent_path: Path, agent_name: str) -> Dict:
        """Validate STATE.json format and required fields."""
        state_json_path = agent_path / "STATE.json"
        
        try:
            with open(state_json_path, 'r') as f:
                state = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {
                "score": 0,
                "violations": ["STATE.json is missing or invalid"],
                "details": {}
            }
        
        required_fields = ["agentNumber", "currentVersion", "status", "lastUpdated"]
        valid_statuses = ["planning", "in-progress", "complete", "active"]
        
        score = {}
        violations = []
        
        # Check required fields
        for field in required_fields:
            if field in state and state[field]:
                score[field] = 1
            else:
                score[field] = 0
                violations.append(f"STATE.json missing required field: {field}")
        
        # Validate status value
        if state.get("status") in valid_statuses:
            score["validStatus"] = 1
        else:
            score["validStatus"] = 0
            if state.get("status"):
                violations.append(f"Invalid status value: {state.get('status')}")
        
        total_score = sum(score.values())
        return {
            "score": (total_score / (len(required_fields) + 1)) * 100,
            "violations": violations,
            "details": score
        }
    
    def check_project_updates(self, agent_name: str) -> Dict:
        """Check if agent is properly documented in project-wide files."""
        violations = []
        score = 0
        details = {}
        
        # Check AGENTS.md
        try:
            with open(AGENTS_MD, 'r') as f:
                agents_content = f.read()
            if re.search(agent_name, agents_content, re.IGNORECASE):
                score += 1
                details["agentsMd"] = True
            else:
                violations.append("Agent not found in AGENTS.md")
                details["agentsMd"] = False
        except FileNotFoundError:
            violations.append("AGENTS.md not found")
            details["agentsMd"] = False
        
        # Check MANIFEST.md
        try:
            with open(MANIFEST_MD, 'r') as f:
                manifest_content = f.read()
            if re.search(agent_name, manifest_content, re.IGNORECASE):
                score += 1
                details["manifestMd"] = True
            else:
                violations.append("Agent documents not found in MANIFEST.md")
                details["manifestMd"] = False
        except FileNotFoundError:
            violations.append("MANIFEST.md not found")
            details["manifestMd"] = False
        
        # Check CLAUDE.md (for completed agents with version)
        try:
            with open(CLAUDE_MD, 'r') as f:
                claude_content = f.read()
            # Look for agent name followed by version pattern
            if re.search(f"{agent_name}.*v\\d+\\.\\d+", claude_content, re.IGNORECASE):
                score += 1
                details["claudeMd"] = True
            else:
                violations.append("Agent completion not reflected in CLAUDE.md")
                details["claudeMd"] = False
        except FileNotFoundError:
            violations.append("CLAUDE.md not found")
            details["claudeMd"] = False
        
        return {
            "score": (score / 3) * 100,
            "violations": violations,
            "details": details
        }
    
    def check_backlog_format(self, agent_path: Path, agent_name: str) -> Dict:
        """Validate backlog.json format and structure."""
        backlog_path = agent_path / "backlog.json"
        
        try:
            with open(backlog_path, 'r') as f:
                backlog = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {
                "score": 0,
                "violations": ["backlog.json is missing or invalid"],
                "details": {}
            }
        
        violations = []
        score = 0
        
        # Check basic structure
        if "backlog" in backlog and isinstance(backlog["backlog"], list):
            score += 1
            
            # Check each backlog item
            required_fields = ["id", "fromAgent", "toAgent", "requestDate", "priority", "status", "request"]
            items_valid = True
            
            for idx, item in enumerate(backlog["backlog"]):
                for field in required_fields:
                    if field not in item or not item[field]:
                        violations.append(f"Backlog item {idx} missing required field: {field}")
                        items_valid = False
            
            if items_valid and backlog["backlog"]:  # Only give point if items are valid
                score += 1
        else:
            violations.append('backlog.json missing "backlog" array')
        
        return {
            "score": (score / 2) * 100,
            "violations": violations,
            "details": {"hasStructure": score >= 1, "itemsValid": score == 2}
        }
    
    def check_agent_compliance(self, agent_folder: str) -> Dict:
        """Run all compliance checks for a single agent."""
        agent_path = AGENTS_DIR / agent_folder
        agent_name = agent_folder
        
        print(f"\nChecking {agent_name}...")
        
        compliance = {
            "documentationStructure": self.check_documentation_structure(agent_path, agent_name),
            "stateJsonFormat": self.check_state_json_format(agent_path, agent_name),
            "projectUpdates": self.check_project_updates(agent_name),
            "backlogFormat": self.check_backlog_format(agent_path, agent_name)
        }
        
        # Calculate overall score
        scores = [c["score"] for c in compliance.values()]
        overall_score = sum(scores) / len(scores)
        
        # Collect all violations
        all_violations = []
        for category, result in compliance.items():
            for violation in result["violations"]:
                all_violations.append(f"[{category}] {violation}")
        
        return {
            "name": agent_name,
            "score": overall_score,
            "grade": self.get_grade(overall_score),
            "compliance": compliance,
            "violations": all_violations
        }
    
    def get_grade(self, score: float) -> str:
        """Convert numeric score to letter grade."""
        if score >= 90: return 'A'
        if score >= 80: return 'B'
        if score >= 70: return 'C'
        if score >= 60: return 'D'
        return 'F'
    
    def get_agent_folders(self) -> List[str]:
        """Get all agent folders matching pattern XX-name."""
        folders = []
        for item in AGENTS_DIR.iterdir():
            if item.is_dir() and re.match(r'^\d{2}-', item.name):
                folders.append(item.name)
        return sorted(folders)
    
    def generate_report(self):
        """Generate and display the compliance report."""
        print("\n" + "=" * 60)
        print("MILE QUEST AUTOMATED COMPLIANCE REPORT")
        print("=" * 60)
        print(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
        print(f"Total Agents Checked: {self.results['summary']['totalAgents']}")
        print(f"Overall Compliance Score: {self.results['summary']['totalScore']:.1f}%")
        print(f"Overall Grade: {self.get_grade(self.results['summary']['totalScore'])}")
        
        print("\n## Agent Scores Summary\n")
        print("| Agent | Score | Grade | Violations |")
        print("|-------|-------|-------|------------|")
        
        for agent in self.results["agents"].values():
            print(f"| {agent['name']} | {agent['score']:.1f}% | {agent['grade']} | {len(agent['violations'])} |")
        
        # Top violations by category
        print("\n## Top Violations\n")
        violation_counts = {}
        for agent in self.results["agents"].values():
            for violation in agent["violations"]:
                match = re.match(r'\[(.*?)\]', violation)
                category = match.group(1) if match else 'other'
                violation_counts[category] = violation_counts.get(category, 0) + 1
        
        for category, count in sorted(violation_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"- {category}: {count} violations")
        
        # Detailed violations
        print("\n## Detailed Violations by Agent\n")
        for agent in self.results["agents"].values():
            if agent["violations"]:
                print(f"### {agent['name']} ({agent['score']:.1f}%)")
                for violation in agent["violations"]:
                    print(f"- {violation}")
                print()
        
        # Save report
        report_path = PROJECT_ROOT / "docs" / "agents" / "13-compliance" / "current" / "automated-compliance-report.json"
        with open(report_path, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\nDetailed report saved to: {report_path}")
    
    def run(self):
        """Main execution method."""
        print("Starting Mile Quest Compliance Check...")
        
        agent_folders = self.get_agent_folders()
        self.results["summary"]["totalAgents"] = len(agent_folders)
        
        for folder in agent_folders:
            agent_result = self.check_agent_compliance(folder)
            self.results["agents"][folder] = agent_result
        
        # Calculate overall score
        if self.results["agents"]:
            total_scores = [a["score"] for a in self.results["agents"].values()]
            self.results["summary"]["totalScore"] = sum(total_scores) / len(total_scores)
        
        self.generate_report()


if __name__ == "__main__":
    checker = ComplianceChecker()
    checker.run()