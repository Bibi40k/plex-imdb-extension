# Firefox Release Validator & Publisher

Automated workflow for validating and releasing Firefox extension builds.

## What this command does:

1. **Validates the current state**
   - Simulates GitHub Actions build process locally
   - Runs Mozilla addons-linter with strict validation
   - Checks for errors, warnings, and notices
   - Ensures icons are correct sizes (16x16, 48x48, 128x128)

2. **Version bump** (optional)
   - Prompts for version bump type: patch (0.2.1 → 0.2.2), minor (0.2.1 → 0.3.0), or major (0.2.1 → 1.0.0)
   - Updates all manifest files (manifest-chrome.json, manifest-firefox.json)
   - Updates CHANGELOG.md with new version section

3. **Commit and tag**
   - Creates descriptive commit with all changes
   - Creates git tag (e.g., v0.2.2)
   - Includes Co-Authored-By: Claude

4. **Push and trigger release**
   - Pushes commit and tags to GitHub
   - Triggers GitHub Actions release workflow
   - Generates build artifacts for Firefox and Chrome

5. **Post-release verification**
   - Provides link to GitHub Actions run
   - Provides link to generated release
   - Shows next steps for uploading to Mozilla AMO

## Usage:

Simply invoke this command and Claude will guide you through the release process.

## Prerequisites:

- Clean git working directory (or only expected changes)
- Mozilla addons-linter installed (`npm install -g addons-linter`)
- All files passing linter validation
- Valid version number format in manifests

## Notes:

- This command will NOT push if linter finds errors
- You can skip version bump if you just want to validate
- GitHub Actions will run additional validation before creating release
- The command will show you the linter results before proceeding
