# Security MCP Setup for Claude Code

This setup connects a custom `security-mcp` server to Claude Code so Claude can fetch GitHub Code Scanning alerts for the current repository and apply local patches.

The `/fix-vuls` skill runs a remediation loop:

```text
/fix-vuls
  → fetch open GitHub Code Scanning alerts
  → triage and classify each alert
  → research CVEs (Spring Boot BOM first for dependency alerts)
  → apply minimal local patches
  → validate with build and tests
  → re-check alerts and repeat until done or blocked
```

Claude does not commit, push, or open a PR unless you explicitly ask. The full skill prompt lives in [`fix-vuls.md`](fix-vuls.md) in this repo.

The GitHub token used to fetch alerts is read from a **`.env` file inside the repo where `claude` is run** — it is never passed on the command line or committed to source control.

---

## 1. Clone and install dependencies

Clone this repo and install Node.js dependencies before connecting the MCP server:

```bash
git clone https://github.com/P-Shreyas-Maersk/security-mcp.git
cd security-mcp
npm install
```

Use the absolute path to this folder when registering the MCP server in the steps below.

---

## 2. Add a `.env` file with your GitHub token

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

## 3. Connect MCP to Claude Code

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

## 4. Verify MCP connection

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

## 5. Open Claude Code in the target repo

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

## 6. Test the MCP manually

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

## 7. Install the fix-vuls skill

This repo ships the skill prompt in [`fix-vuls.md`](fix-vuls.md). Do not copy the content by hand — copy or move that file into the skill or slash-command folder for your target repo and tool.

**Claude Code slash command** — copy into the repo you scan:

**macOS:**

```bash
mkdir -p your-org-repo/.claude/commands
cp /absolute/path/to/security-mcp/fix-vuls.md your-org-repo/.claude/commands/fix-vuls.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force your-org-repo\.claude\commands
Copy-Item C:\absolute\path\to\security-mcp\fix-vuls.md your-org-repo\.claude\commands\fix-vuls.md
```

**Cursor project skill** — copy into the repo you scan:

**macOS:**

```bash
mkdir -p your-org-repo/.cursor/skills/fix-vuls
cp /absolute/path/to/security-mcp/fix-vuls.md your-org-repo/.cursor/skills/fix-vuls/SKILL.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force your-org-repo\.cursor\skills\fix-vuls
Copy-Item C:\absolute\path\to\security-mcp\fix-vuls.md your-org-repo\.cursor\skills\fix-vuls\SKILL.md
```

Replace `/absolute/path/to/security-mcp` with the path where you cloned this repo, and `your-org-repo` with the repository you want to remediate.

When the skill is updated here, re-copy `fix-vuls.md` to your target folder to pick up changes.

---

## 8. Run the final command

Inside Claude Code:

```text
/fix-vuls
```

Expected final behavior:

```text
Remediation complete after 2 cycles.

Fixed:
- Alert #4 (java/sql-injection) — src/main/java/.../Repository.java
- Alert #7 (CVE-2024-XXXX) — root pom.xml Spring Boot 3.2.x → 3.2.y

Fixed locally, pending GitHub rescan:
- Alert #9 (java/path-injection) — green build; push and wait for CodeQL rescan

Blocked:
- Alert #12 — generated code; cannot patch locally

Build: mvn -B test — SUCCESS

No commit, push, or PR was performed.
```

---

## 9. Developer review

After the remediation loop finishes, review the summary and local diff:

```bash
git diff
```

Claude runs build and tests during the loop, but confirm the results in your environment before committing.

If the changes look good, create a branch, commit, push, and open a PR using your normal team workflow. GitHub Code Scanning alerts will update after the push and CodeQL rescan.

---

## Final lifecycle

```text
Developer runs /fix-vuls
        ↓
Claude detects GitHub repo
        ↓
Security MCP fetches Code Scanning alerts
        ↓
Claude triages, researches CVEs, patches, and validates (loop)
        ↓
Claude reports summary (fixed / blocked / pending rescan)
        ↓
Developer reviews diff, commits, pushes, and raises PR manually
```