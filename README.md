# Security MCP Setup for Claude Code

This setup connects a custom `security-mcp` server to Claude Code so Claude can fetch GitHub Code Scanning alerts for the current repository and apply local patches.

The lifecycle is intentionally limited:

```text
/fix-vuls
  → fetch open GitHub Code Scanning alerts
  → map alerts to local files
  → apply minimal local patches
  → stop
```

No branch, commit, push, PR, test run, build, or validation is performed by Claude.

The GitHub token used to fetch alerts is read from a **`.env` file inside the repo where `claude` is run** — it is never passed on the command line or committed to source control.

---

## 1. Add a `.env` file with your GitHub token

The GitHub token is **not** passed as a CLI flag. Instead, create a `.env` file **inside the repo where you run `claude`** (i.e. the org repo you want to scan, not the `security-mcp` server folder).

For the current v1, the token only needs access to read security/code scanning alerts.

**macOS:**

```bash
cd your-org-repo
echo "GITHUB_TOKEN=YOUR_GITHUB_TOKEN" > .env
```

**Windows (PowerShell):**

```powershell
cd your-org-repo
"GITHUB_TOKEN=YOUR_GITHUB_TOKEN" | Out-File -Encoding utf8 .env
```

**Windows (Command Prompt):**

```cmd
cd your-org-repo
echo GITHUB_TOKEN=YOUR_GITHUB_TOKEN > .env
```

Replace `YOUR_GITHUB_TOKEN` with a GitHub token that has permission to read Code Scanning alerts.

> ⚠️ Add `.env` to `.gitignore` so the token is never committed.

---

## 2. Connect MCP to Claude Code

From the same repo folder, add the MCP server (no token flag needed — `security-mcp` reads it from `.env` at runtime):

**macOS:**

```bash
claude mcp add security-mcp -- node /absolute/path/to/security-mcp/server.js
```

Example:

```bash
claude mcp add security-mcp -- node /Users/p.shreyas/workplace/experiment/code-vuls/security-mcp/server.js
```

**Windows (PowerShell / Command Prompt):**

```powershell
claude mcp add security-mcp -- node C:\absolute\path\to\security-mcp\server.js
```

Example:

```powershell
claude mcp add security-mcp -- node C:\Users\shreyas\workplace\experiment\code-vuls\security-mcp\server.js
```

---

## 3. Verify MCP connection

Run:

```bash
claude mcp list
```

Expected output:

```text
security-mcp  ✓ Connected
```

If the server is not connected, restart Claude Code and verify the MCP path and `.env` file.

---

## 4. Open Claude Code in the target repo

Go to your org repo (the same folder containing your `.env` file):

**macOS:**

```bash
cd your-org-repo
claude
```

Example:

```bash
cd /Users/p.shreyas/workplace/vas-experience-api
claude
```

**Windows (PowerShell / Command Prompt):**

```powershell
cd your-org-repo
claude
```

Example:

```powershell
cd C:\Users\shreyas\workplace\vas-experience-api
claude
```

---

## 5. Test the MCP manually

Inside Claude Code, run this prompt:

```text
Use the security-mcp tool to list open code scanning alerts for this current GitHub repo. Detect owner and repo from git remote.
```

Expected result:

```text
Found open code scanning alerts:
- java/sql-injection ...
- java/path-injection ...
- java/log-injection ...
```

If you see this error:

```text
Missing GITHUB_TOKEN in environment
```

Check the following:
- A `.env` file exists in the repo folder you ran `claude` from (not the `security-mcp` server folder).
- The `.env` file contains a line exactly like `GITHUB_TOKEN=YOUR_GITHUB_TOKEN`, with no quotes or extra spaces.
- You restarted Claude Code (`claude`) after creating or editing `.env`.

If needed, remove and re-add the MCP:

**macOS:**

```bash
claude mcp remove security-mcp
claude mcp add security-mcp -- node /absolute/path/to/security-mcp/server.js
```

**Windows:**

```powershell
claude mcp remove security-mcp
claude mcp add security-mcp -- node C:\absolute\path\to\security-mcp\server.js
```

Then restart Claude Code.

---

## 6. Create the Claude slash command

Inside the repo, create:

**macOS:**

```bash
mkdir -p .claude/commands
touch .claude/commands/fix-vuls.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force .claude\commands
New-Item -ItemType File -Force .claude\commands\fix-vuls.md
```

**Windows (Command Prompt):**

```cmd
mkdir .claude\commands
type nul > .claude\commands\fix-vuls.md
```

Add this content to `.claude/commands/fix-vuls.md`:

```md
You are a local security remediation agent for this repository.

Goal:
Fetch open GitHub code scanning vulnerabilities for the current repo and apply safe fixes locally only.

Use the Security MCP tools where available.

Lifecycle:
Your lifecycle ends immediately after applying patches locally.

Steps:
1. Detect the current GitHub owner/repo from git remote.
2. Fetch open GitHub code scanning alerts for this repo.
3. For each open alert, read:
   - rule ID
   - severity
   - affected file
   - affected line
   - alert message
   - code scanning location details
4. Map each alert to the matching local source file.
5. Apply the smallest safe patch that directly addresses the alert.
6. Stop after patching.
7. Summarize:
   - alerts patched
   - files changed
   - alerts skipped
   - reason for each skipped alert
   - reminder that validation was not run

Strict rules:
- Do not create a branch.
- Do not commit.
- Do not push.
- Do not create a PR.
- Do not auto-merge.
- Do not run tests.
- Do not run build.
- Do not run validation.
- Do not run dependency audit.
- Do not modify CI/CD configuration.
- Do not suppress CodeQL/code scanning alerts unless the alert is clearly false positive and the local code change is unnecessary.
- Do not delete tests.
- Do not make broad refactors.
- Do not change unrelated files.
- Keep all fixes minimal and local.
```

---

## 7. Run the final command

Inside Claude Code:

```text
/fix-vuls
```

Expected final behavior:

```text
Applied local patches for 3 code scanning alerts.

Files changed:
- src/main/java/...
- src/main/java/...

Skipped:
- Alert #12 because affected file was generated code.

Stopped after applying patches locally.

No tests, build, validation, branch, commit, push, or PR were performed.
```

---

## 8. Developer review

After Claude stops, the developer owns the next steps.

Recommended manual checks:

```bash
git diff
```

Then run project-specific validation manually, for example:

```bash
mvn test
```

or:

```bash
npm test
```

If the changes look good, the developer can manually create a branch, commit, push, and PR using the normal team workflow.

---

## Final lifecycle

```text
Developer runs /fix-vuls
        ↓
Claude detects GitHub repo
        ↓
Security MCP fetches Code Scanning alerts
        ↓
Claude applies minimal local patches
        ↓
Claude stops
        ↓
Developer reviews, tests, commits, and raises PR manually
```