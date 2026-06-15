# Agentic E2E

Personal QA Agent CLI for Next.js E2E testing.

Agentic E2E scans your Next.js routes, generates Playwright tests, runs them, creates reports, and analyzes failed tests with healing suggestions.

## Features

- Initialize E2E setup
- Scan Next.js App Router routes
- Generate Playwright E2E tests
- Run tests
- Generate JSON and Markdown reports
- Analyze failed tests and suggest fixes
- Configurable via `.agentic-e2e.config.ts`

## Installation

```bash
npm install -D agentic-e2e
```

Or run with npx after publishing:

```bash
npx agentic-e2e init
npx agentic-e2e check
```

## Quick Start

```bash
agentic-e2e init
agentic-e2e check
```

## Main Commands

### Initialize

```bash
agentic-e2e init
```

Creates:

```txt
.agentic-e2e.config.ts
playwright.config.ts
tests/e2e/example.spec.ts
```

### Check

```bash
agentic-e2e check
```

Runs the full workflow:

```txt
scan → generate → report → heal
```

## Advanced Commands

### Scan routes

```bash
agentic-e2e scan
```

### Generate tests

```bash
agentic-e2e generate
```

Overwrite generated tests:

```bash
agentic-e2e generate --force
```

### Run tests

```bash
agentic-e2e run
```

### Generate report

```bash
agentic-e2e report
```

### Analyze failed tests

```bash
agentic-e2e heal
```

## Configuration

Create or edit:

```ts
export default {
  framework: "nextjs",
  baseUrl: "http://localhost:3000",
  testDir: "tests/e2e",
  generatedDir: "tests/e2e/generated",
  reportsDir: ".agentic-e2e/reports",
  healDir: ".agentic-e2e/heal",
  runner: "playwright",
  agent: {
    mode: "review-before-write"
  },
  check: {
    heal: true
  }
};
```

## Reports

After running:

```bash
agentic-e2e check
```

Reports are saved to:

```txt
.agentic-e2e/reports/latest.json
.agentic-e2e/reports/latest.md
.agentic-e2e/heal/latest.json
.agentic-e2e/heal/latest.md
```

## Recommended Workflow

```bash
agentic-e2e init
agentic-e2e check
```

For CI:

```bash
agentic-e2e check --no-heal
```

## Current Status

This package currently supports:

- Next.js
- Playwright
- App Router route scanning
- Rule-based failure analysis

Coming later:

- AI test planning
- AI healing suggestions
- React Native support
- GitHub Actions integration