# Quick Build Validator

Fast validation of Firefox/Chrome extension builds without creating a release.

## What this command does:

1. **Simulates build process**
   - Creates temporary dist/ directory
   - Copies files exactly as GitHub Actions would
   - Fixes manifest references (background-firefox.js → background.js)
   - Excludes dev files (.git, .md, screenshots, etc.)

2. **Runs linter validation**
   - Mozilla addons-linter for Firefox build
   - Shows errors, warnings, and notices
   - Validates manifest compliance

3. **Reports results**
   - Clear summary of validation status
   - Detailed breakdown of any issues found
   - Suggestions for fixes if errors present

4. **Cleans up**
   - Removes temporary build directory
   - Leaves working directory clean

## Usage:

Invoke this command whenever you want to verify your changes will pass validation before committing.

## When to use:

- ✅ After modifying manifest files
- ✅ After changing popup.js or background scripts
- ✅ Before creating commits
- ✅ When fixing Mozilla AMO validation errors
- ✅ During development to catch issues early

## What it validates:

- Manifest schema compliance
- Icon sizes and formats
- Background script references
- Required Firefox-specific fields (data_collection_permissions, etc.)
- Security issues (innerHTML usage, CSP violations)
- File structure and naming

## Fast feedback loop:

This command runs in ~5 seconds and gives you immediate feedback without:
- Creating commits
- Pushing to GitHub
- Waiting for CI/CD
- Creating releases
