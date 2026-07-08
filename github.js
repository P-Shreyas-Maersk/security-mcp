import process from "process";

const GITHUB_API = "https://api.github.com";

export async function listCodeScanningAlerts({ owner, repo }) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("Missing GITHUB_TOKEN in environment");
  }

  const url =
    `${GITHUB_API}/repos/${owner}/${repo}/code-scanning/alerts` +
    `?state=open&per_page=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "security-mcp"
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API failed: ${res.status} ${body}`);
  }

  const alerts = await res.json();

  return alerts.map((alert) => ({
    number: alert.number,
    state: alert.state,
    rule_id: alert.rule?.id,
    rule_name: alert.rule?.name,
    severity: alert.rule?.security_severity_level || alert.rule?.severity,
    description: alert.rule?.description,
    tool: alert.tool?.name,
    url: alert.html_url,
    most_recent_instance: {
      file: alert.most_recent_instance?.location?.path,
      start_line: alert.most_recent_instance?.location?.start_line,
      end_line: alert.most_recent_instance?.location?.end_line,
      message: alert.most_recent_instance?.message?.text
    }
  }));
}