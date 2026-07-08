import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listCodeScanningAlerts } from "./github.js";

const server = new McpServer({
  name: "security-mcp",
  version: "1.0.0"
});

server.registerTool(
  "list_code_scanning_alerts",
  {
    title: "List Code Scanning Alerts",
    description:
      "List open GitHub code scanning alerts for a repository. This tool only reads alerts and does not modify GitHub.",
    inputSchema: {
      owner: z.string(),
      repo: z.string()
    }
  },
  async ({ owner, repo }) => {
    const alerts = await listCodeScanningAlerts({ owner, repo });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: alerts.length,
              alerts
            },
            null,
            2
          )
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);