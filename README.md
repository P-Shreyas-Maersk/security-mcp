# Security MCP Setup

This setup connects the `security-mcp` server to AI coding tools so the agent can fetch GitHub Code Scanning alerts for the current repository and apply local patches.

Supported clients:

- **Claude Code** — MCP via `claude mcp add`, slash command via `.claude/commands/fix-vuls.md`
- **Cursor** — MCP via settings, skill via `.cursor/skills/fix-vuls/SKILL.md`
- **GitHub Copilot CLI** — MCP via `copilot mcp add` or `.github/mcp.json`, skill via `.github/skills/fix-vuls/SKILL.md`
- **IntelliJ IDEA (GitHub Copilot plugin)** — MCP via Copilot Chat Agent mode widget, skill via `.github/skills/fix-vuls/SKILL.md`

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

The agent does not commit, push, or open a PR unless you explicitly ask. The full skill prompt lives in [`fix-vuls.md`](fix-vuls.md) in this repo.

The GitHub token used to fetch alerts is read from a **`.env` file inside the repo you are remediating** (the org repo you open in your IDE or CLI) — it is never passed on the command line or committed to source control. You can also set `GITHUB_TOKEN` in MCP server `env` configuration where your client supports it.

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

The GitHub token is **not** passed as a CLI flag. Instead, create a `.env` file **inside the org repo you want to scan** (not the `security-mcp` server folder).

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

## 3. Claude Code — connect MCP

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

**GitHub Copilot skill** — copy into the repo you scan as `SKILL.md` (Copilot requires YAML frontmatter; see [section 11](#11-github-copilot-cli--fix-vuls-skill) or [section 13](#13-intellij-idea--fix-vuls-skill)):

**macOS:**

```bash
mkdir -p your-org-repo/.github/skills/fix-vuls
cp /absolute/path/to/security-mcp/fix-vuls.md your-org-repo/.github/skills/fix-vuls/SKILL.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force your-org-repo\.github\skills\fix-vuls
Copy-Item C:\absolute\path\to\security-mcp\fix-vuls.md your-org-repo\.github\skills\fix-vuls\SKILL.md
```

Then add the YAML frontmatter shown in sections 11 or 13 to the top of `SKILL.md`.

Replace `/absolute/path/to/security-mcp` with the path where you cloned this repo, and `your-org-repo` with the repository you want to remediate.

When the skill is updated here, re-copy `fix-vuls.md` to your target folder to pick up changes.

---

## 8. Claude Code — run the command

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

## 10. GitHub Copilot CLI — MCP server

Prerequisites:

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli) installed and signed in
- Steps [1](#1-clone-and-install-dependencies) and [2](#2-add-a-env-file-with-your-github-token) completed
- Open a terminal in the **org repo you want to scan** (the folder containing your `.env` file)

### Option A — register globally with `copilot mcp add`

**macOS:**

```bash
copilot mcp add security-mcp -- node /absolute/path/to/security-mcp/server.js
```

**Windows (PowerShell / Command Prompt):**

```powershell
copilot mcp add security-mcp -- node C:\absolute\path\to\security-mcp\server.js
```

If the MCP process cannot read your target repo `.env`, pass the token explicitly:

**macOS:**

```bash
copilot mcp add security-mcp -e GITHUB_TOKEN=YOUR_GITHUB_TOKEN -- node /absolute/path/to/security-mcp/server.js
```

**Windows (PowerShell):**

```powershell
copilot mcp add security-mcp -e GITHUB_TOKEN=YOUR_GITHUB_TOKEN -- node C:\absolute\path\to\security-mcp\server.js
```

Verify:

```bash
copilot mcp list
copilot mcp get security-mcp
```

### Option B — commit project MCP config in the org repo

Add `.github/mcp.json` in the repo you scan so collaborators get the same setup:

**macOS example** (`your-org-repo/.github/mcp.json`):

```json
{
  "mcpServers": {
    "security-mcp": {
      "type": "local",
      "command": "node",
      "args": ["/Users/you/workplace/projects/security-mcp/server.js"],
      "env": {
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"
      },
      "tools": ["*"]
    }
  }
}
```

**Windows example** (`your-org-repo\.github\mcp.json`):

```json
{
  "mcpServers": {
    "security-mcp": {
      "type": "local",
      "command": "node",
      "args": ["C:\\Users\\you\\workplace\\projects\\security-mcp\\server.js"],
      "env": {
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"
      },
      "tools": ["*"]
    }
  }
}
```

Start Copilot CLI from the org repo root. On first use, confirm folder trust when prompted so project MCP servers load.

Inside an interactive session you can also run `/mcp add`, choose **STDIO**, and enter `node /absolute/path/to/security-mcp/server.js`.

---

## 11. GitHub Copilot CLI — fix-vuls skill

GitHub Copilot skills must live in a folder named after the skill and use a file called `SKILL.md` with YAML frontmatter.

1. Copy [`fix-vuls.md`](fix-vuls.md) into your org repo:

**macOS:**

```bash
mkdir -p your-org-repo/.github/skills/fix-vuls
cp /absolute/path/to/security-mcp/fix-vuls.md your-org-repo/.github/skills/fix-vuls/SKILL.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force your-org-repo\.github\skills\fix-vuls
Copy-Item C:\absolute\path\to\security-mcp\fix-vuls.md your-org-repo\.github\skills\fix-vuls\SKILL.md
```

2. Add this frontmatter block at the very top of `SKILL.md`:

```yaml
---
name: fix-vuls
description: Fetch open GitHub code scanning alerts, apply minimal local fixes, validate with build/tests, and loop until alerts are resolved or blocked. Use when asked to fix vulnerabilities, code scanning alerts, CVEs, or /fix-vuls.
---
```

3. Start Copilot CLI in the org repo and reload skills:

```bash
cd your-org-repo
copilot
```

```text
/skills reload
/skills list
```

4. Run remediation:

```text
Use the /fix-vuls skill to fetch open code scanning alerts for this repo and fix them locally.
```

---

## 12. IntelliJ IDEA — MCP server (Copilot widget)

Prerequisites:

- IntelliJ IDEA with the latest **GitHub Copilot** plugin
- **Agent mode** enabled in Copilot Chat (MCP tools are available in Agent mode)
- Steps [1](#1-clone-and-install-dependencies) and [2](#2-add-a-env-file-with-your-github-token) completed
- Org repo opened as the IntelliJ project (the folder containing your `.env` file)
- If your organization uses Copilot Business/Enterprise, the **MCP servers in Copilot** policy must be enabled

### Configure via Copilot Chat widget

1. Open your org repo in IntelliJ IDEA.
2. Click the **GitHub Copilot** icon in the **status bar** (bottom-right corner).
3. Select **Open Chat**.
4. In the chat panel, switch the mode dropdown to **Agent**.
5. Click the **tools** icon at the bottom of the chat panel (**Configure your MCP server**).
6. Click **Add MCP Tools** (or **Add More Tools...**).
7. In the `mcp.json` editor, add the `security-mcp` server entry below.
8. Save the file with **Command + S** (macOS) or **Ctrl + S** (Windows). Restart the IDE if tools do not appear immediately.
9. Click the **tools** icon again and confirm `list_code_scanning_alerts` is listed under `security-mcp`.

### Alternative — open MCP settings from the status bar

1. Click the **GitHub Copilot** icon in the status bar.
2. Select **Edit Settings**.
3. Open **Model Context Protocol** → **Configure**.
4. Edit `mcp.json` with the same server entry below and save.

### `mcp.json` entry for security-mcp

**macOS:**

```json
{
  "servers": {
    "security-mcp": {
      "command": "node",
      "args": ["/Users/you/workplace/projects/security-mcp/server.js"],
      "env": {
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"
      }
    }
  }
}
```

**Windows:**

```json
{
  "servers": {
    "security-mcp": {
      "command": "node",
      "args": ["C:\\Users\\you\\workplace\\projects\\security-mcp\\server.js"],
      "env": {
        "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"
      }
    }
  }
}
```

Replace the `args` path with your cloned `security-mcp` folder. If `.env` is present in the opened IntelliJ project, you can omit `env` and let `dotenv` load `GITHUB_TOKEN` from the project root instead.

### Test in Agent mode

In Copilot Chat (Agent mode), run:

```text
Use the security-mcp tool to list open code scanning alerts for this current GitHub repo. Detect owner and repo from git remote.
```

---

## 13. IntelliJ IDEA — fix-vuls skill

IntelliJ Agent mode uses the same [Agent Skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills) layout as Copilot CLI.

1. Copy [`fix-vuls.md`](fix-vuls.md) into your org repo:

**macOS:**

```bash
mkdir -p your-org-repo/.github/skills/fix-vuls
cp /absolute/path/to/security-mcp/fix-vuls.md your-org-repo/.github/skills/fix-vuls/SKILL.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force your-org-repo\.github\skills\fix-vuls
Copy-Item C:\absolute\path\to\security-mcp\fix-vuls.md your-org-repo\.github\skills\fix-vuls\SKILL.md
```

2. Add YAML frontmatter at the top of `SKILL.md` (same as [section 11](#11-github-copilot-cli--fix-vuls-skill)):

```yaml
---
name: fix-vuls
description: Fetch open GitHub code scanning alerts, apply minimal local fixes, validate with build/tests, and loop until alerts are resolved or blocked. Use when asked to fix vulnerabilities, code scanning alerts, CVEs, or /fix-vuls.
---
```

3. Reopen the project or restart IntelliJ if the skill does not appear immediately.

4. In Copilot Chat (**Agent mode**), run:

```text
Use the /fix-vuls skill to fetch open code scanning alerts for this repo and fix them locally.
```

When `fix-vuls.md` is updated in this repo, re-copy it to `.github/skills/fix-vuls/SKILL.md` in your org repo (keep the frontmatter block).

---

## Final lifecycle

```text
Developer runs /fix-vuls (Claude Code, Cursor, or Copilot Agent mode)
        ↓
Agent detects GitHub repo
        ↓
Security MCP fetches Code Scanning alerts
        ↓
Agent triages, researches CVEs, patches, and validates (loop)
        ↓
Agent reports summary (fixed / blocked / pending rescan)
        ↓
Developer reviews diff, commits, pushes, and raises PR manually
```