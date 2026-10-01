---
name: qa-agent
role: QA & Testing Automation
sprite: qa
color: "#b026ff"
dependsOn:
  - frontend
  - backend
  - database
skills:
  - testing
  - e22-testing
  - regression-suite
permissions:
  read: ["**/*"]
  write: ["tests/**", "__tests__/**", "cypress/**", "playwright/**"]
---

# QA Agent

Specialized in integration testing, unit test coverage, end-to-end user journeys, and regression verification across all components.
