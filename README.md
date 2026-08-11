# Security MCP Setup for Claude Code

This setup connects a custom `security-mcp` server to Claude Code so Claude can fetch GitHub Code Scanning alerts for the current repository and apply local patches.

The `/fix-vuls` slash command runs a remediation loop:

```text
/fix-vuls
  → fetch open GitHub Code Scanning alerts
  → triage and classify each alert
  → research CVEs (Spring Boot BOM first for dependency alerts)
  → apply minimal local patches
  → validate with build and tests
  → re-check alerts and repeat until done or blocked
```

Claude does not commit, push, or open a PR unless you explicitly ask.

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
Fetch open GitHub code scanning vulnerabilities for the current repo, fix them, and keep working in a loop until every fixable alert is resolved locally or you are blocked.

Use the Security MCP tools where available.

## Fix cycle (repeat until done)

Run this cycle until one of the exit conditions below is met. Do not stop after the first patch.

### Exit conditions
- **Success:** MCP returns zero open alerts, or every remaining alert is documented as unfixable locally with a clear reason.
- **Blocked:** Two consecutive cycles make no progress on the same alert(s), or you hit the max iteration limit (10 cycles).
- **Build broken:** After 3 attempts you cannot restore a green build for the same change set — stop, summarize, and list what is still failing.

### Each cycle

1. **Discover**
   - Detect the current GitHub owner/repo from `git remote`.
   - Call the Security MCP tool to list open code scanning alerts.
   - If count is 0, stop with a success summary.

2. **Triage each open alert**
   For every alert, capture:
   - alert number
   - rule ID / rule name
   - severity
   - tool (CodeQL, Dependabot, etc.)
   - affected file and line(s)
   - alert message and location details

   Classify the fix type:
   - **Source code** — logic, injection, path traversal, secrets in code, unsafe API usage
   - **Dependency / CVE** — vulnerable transitive/direct dependency; requires verified version research before any bump
   - **Configuration** — unsafe defaults in config files (minimal change only)
   - **False positive** — only if the alert is clearly wrong; document why and skip

3. **Research the CVE before any version bump (required for dependency alerts)**

   Do **not** guess a patched version. Verify the fix path with evidence first.

   For each dependency/CVE alert, record:
   - CVE ID(s) from the alert (e.g. `CVE-2024-XXXX`)
   - vulnerable `groupId:artifactId` and the version currently on the classpath
   - current Spring Boot parent version from root `pom.xml`

   Check what is actually in use:
   ```bash
   mvn -B dependency:tree -Dincludes=groupId:artifactId
   mvn -B help:effective-pom -Doutput=target/effective-pom.xml
   ```

   **Step A — prefer Spring Boot first**

   Spring Boot's BOM manages most transitive dependencies. Before overriding a single library version, check whether a **Spring Boot patch/minor bump** already pulls in a fixed version.

   1. Read the current parent: `spring-boot-starter-parent` version in root `pom.xml`.
   2. Web search and read official release sources:
      - [Spring Boot releases](https://github.com/spring-projects/spring-boot/releases)
      - Spring Boot release notes / CVE advisories for the target version
      - `spring-boot-dependencies` BOM for the candidate Spring Boot version (GitHub tag or Maven Central)
   3. Confirm the CVE is explicitly fixed in that Spring Boot release, or that the managed dependency version in that BOM is at/above the patched version cited in the advisory.
   4. If a Spring Boot bump fixes it, prefer that over pinning individual artifacts — smallest change that resolves the CVE with verified evidence.

   **Step B — if Spring Boot alone does not fix it**

   Research the vulnerable library directly from open-source release/security sources:
   - Project GitHub **Releases** and **Security Advisories**
   - Official changelog / release notes mentioning the CVE
   - GitHub Advisory Database or NVD entry cross-linked to a fixed release

   Use web search to find which **exact release version** contains the fix. Do not assume "latest" is safe or that a random patch version works.

   Example searches:
   - `CVE-2024-XXXX spring-boot fixed version`
   - `CVE-2024-XXXX groupId artifactId github release`
   - `site:github.com spring-projects/spring-boot CVE-2024-XXXX`

   **Step C — choose the narrowest verified fix**

   Pick one path based on evidence, in this order:
   1. Bump `spring-boot-starter-parent` to the verified fixed Spring Boot version.
   2. Override only the affected artifact via root `pom.xml` `properties` or `dependencyManagement` when Spring Boot cannot be bumped yet but a patched version is confirmed compatible with the current Spring Boot line.
   3. Direct module dependency bump only when the artifact is explicitly declared and not managed by the BOM.

   Before editing `pom.xml`, write a short note per alert:
   - CVE
   - current version on classpath
   - chosen fix (Spring Boot bump or artifact override)
   - target version
   - source URL(s) proving the fix (release notes, advisory, BOM entry)

   If you cannot find authoritative evidence of a fixed version compatible with this repo, mark the alert **blocked** and explain what was searched — do not invent a version.

4. **Apply the smallest safe fix**
   - Prefer targeted edits over broad refactors.
   - For dependency/CVE alerts:
     - Apply only the fix path verified in step 3.
     - Update root `pom.xml` parent and/or `properties` / `dependencyManagement` — not scattered module POMs unless necessary.
     - After the bump, re-run `dependency:tree` and confirm the vulnerable artifact version changed to the expected patched version.
   - For code alerts:
     - Map the alert to the local file and apply the minimal patch at the reported location.
   - Do not suppress or dismiss alerts unless clearly false positive.
   - Do not delete tests.
   - Do not change unrelated files.
   - Do not modify CI/CD configuration unless the alert is explicitly about CI and cannot be fixed any other way.

5. **Validate locally (required every cycle)**
   Run validation after applying fixes. Fix any regressions before moving on.

   Default build commands for this repo (Maven multi-module):
   ```bash
   mvn -B compile -DskipTests
   mvn -B test
   ```

   Use narrower scope when the change is isolated:
   ```bash
   mvn -B -pl service -am test
   ```

   For dependency-only changes, also run:
   ```bash
   mvn -B dependency:tree -Dincludes=groupId:artifactId
   ```

   If compile or tests fail:
   - Read the failure output.
   - Adjust the fix (version bump, code change, exclusion + replacement, etc.).
   - Re-run validation.
   - Do not proceed to the next alert while the build is red.

6. **Re-check progress**
   - Call MCP again to refresh the open alert list.
   - Note: GitHub alerts may still show as open until changes are pushed and rescanned. Treat a **green local build + correct fix applied** as progress even if MCP still lists the alert.
   - Track per-alert status: `fixed`, `fixed-pending-rescan`, `skipped`, `blocked`.
   - If the same alert persists across cycles with no new approach available, mark it blocked and move on.

7. **Loop**
   - If alerts remain fixable, start the next cycle from step 1.
   - Prioritize critical/high severity first, then medium, then low.

## Final summary (required)

When the cycle ends, report:

- Total cycles run
- Alerts fixed (with alert number, rule, file, and what changed)
- Dependency bumps (artifact, old version → new version, file changed, **evidence URL**)
- CVE research notes (Spring Boot BOM checked first; release/advisory links used)
- Alerts fixed locally but still open on GitHub pending push/rescan
- Alerts skipped or blocked (with reason for each)
- Files changed
- Build/test commands run and their final status
- Remaining manual steps for the user (e.g. push branch, open PR, wait for CodeQL rescan)

## Strict rules

- Do not commit unless the user explicitly asks.
- Do not push.
- Do not create a PR unless the user explicitly asks.
- Do not auto-merge.
- Do not bump dependency versions without verified CVE fix evidence from official release notes, advisories, or Spring Boot BOM.
- Do not assume `latest` fixes a CVE — confirm the exact fixed version first.
- Keep all fixes minimal and focused on the reported vulnerability.
- Run build and tests as part of the loop — validation is required, not optional.
```

---

## 7. Run the final command

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

## 8. Developer review

After Claude finishes the remediation loop, review the summary and local diff:

```bash
git diff
```

Claude runs build and tests during the loop, but you should confirm the results match your environment before committing.

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