#!/usr/bin/env node
// Erato MCP-Server (stdio).
//
// Stellt Tools bereit, mit denen ein AI-Client die Erato-Doku lesen und
// schreiben kann. Jedes Tool ruft die Erato-API ueber den erato-client auf.
//
// SDK: @modelcontextprotocol/sdk (v1.x). Verwendete Import-Struktur:
//   - McpServer            aus "@modelcontextprotocol/sdk/server/mcp.js"
//   - StdioServerTransport aus "@modelcontextprotocol/sdk/server/stdio.js"
//   - registerTool(name, { description, inputSchema }, handler)
//   inputSchema ist eine Map von Feldname -> Zod-Schema (raw shape).
//
// Hinweis: Das SDK bringt "zod" als Dependency mit; wir importieren es daraus.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  listNotebooks,
  listPages,
  getPage,
  createPage,
  updatePage,
  searchDocs,
} from "./erato-client.js";

const server = new McpServer({
  name: "erato-mcp",
  version: "0.1.0",
});

// Hilfsfunktion: Text-Inhalt fuer ein Tool-Result.
function text(value) {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text: str }] };
}

// Hilfsfunktion: Fehler als (nicht-werfendes) Tool-Result, damit der Client
// eine aussagekraeftige Meldung erhaelt statt eines harten Transport-Fehlers.
function errorResult(err) {
  return {
    isError: true,
    content: [{ type: "text", text: `Fehler: ${err.message}` }],
  };
}

// Kleiner Wrapper: faengt Fehler ab und formatiert sie einheitlich.
function tool(handler) {
  return async (args) => {
    try {
      return await handler(args);
    } catch (err) {
      return errorResult(err);
    }
  };
}

// Rendert den Seitenbaum als eingerueckte Liste (zusaetzlich zum JSON).
function renderTree(nodes, depth = 0) {
  let out = "";
  for (const n of nodes || []) {
    out += `${"  ".repeat(depth)}- ${n.title} [${n.id}]\n`;
    if (n.children && n.children.length) {
      out += renderTree(n.children, depth + 1);
    }
  }
  return out;
}

// --- Tools ---

server.registerTool(
  "list_notebooks",
  {
    description:
      "Listet alle Erato-Notizbuecher auf (id, title, icon). Nutze die id fuer list_pages oder create_page.",
    inputSchema: {},
  },
  tool(async () => {
    const notebooks = await listNotebooks();
    return text(notebooks);
  })
);

server.registerTool(
  "list_pages",
  {
    description:
      "Liefert den Seitenbaum eines Notizbuchs als verschachtelte Struktur (id, title, parentId, position, children).",
    inputSchema: {
      notebookId: z.string().describe("Die id des Notizbuchs (aus list_notebooks)."),
    },
  },
  tool(async ({ notebookId }) => {
    const tree = await listPages(notebookId);
    const rendered = renderTree(tree).trim();
    return text(
      `${rendered || "(keine Seiten)"}\n\n--- JSON ---\n${JSON.stringify(tree, null, 2)}`
    );
  })
);

server.registerTool(
  "read_page",
  {
    description:
      "Liest eine Seite und gibt Titel sowie den Markdown-Inhalt zurueck.",
    inputSchema: {
      pageId: z.string().describe("Die id der Seite."),
    },
  },
  tool(async ({ pageId }) => {
    const page = await getPage(pageId);
    return text(
      `# ${page.title}\n\n(pageId: ${page.id}, notebookId: ${page.notebookId}, updatedAt: ${page.updatedAt})\n\n---\n\n${page.contentMd ?? ""}`
    );
  })
);

server.registerTool(
  "search_docs",
  {
    description:
      "Volltextsuche ueber alle Seiten. Liefert Treffer mit pageId, notebookPath, Titel und Snippet. Nutzt Hybrid-Suche, falls verfuegbar.",
    inputSchema: {
      query: z.string().describe("Der Suchbegriff / die Suchanfrage."),
    },
  },
  tool(async ({ query }) => {
    const hits = await searchDocs(query);
    if (!Array.isArray(hits) || hits.length === 0) {
      return text(`Keine Treffer fuer "${query}".`);
    }
    const lines = hits.map((h) => {
      const path = Array.isArray(h.notebookPath)
        ? h.notebookPath.join(" / ")
        : h.notebookPath || "";
      return `- ${h.title} [${h.pageId}]${path ? ` (${path})` : ""}\n  ${(h.snippet || "").replace(/\n/g, " ")}`;
    });
    return text(`${hits.length} Treffer:\n\n${lines.join("\n")}`);
  })
);

server.registerTool(
  "create_page",
  {
    description:
      "Erstellt eine neue Seite in einem Notizbuch und setzt deren Markdown-Inhalt. Optional als Unterseite via parentId. Gibt die neue pageId zurueck.",
    inputSchema: {
      notebookId: z.string().describe("id des Ziel-Notizbuchs."),
      title: z.string().describe("Titel der neuen Seite."),
      markdown: z.string().describe("Markdown-Inhalt der neuen Seite."),
      parentId: z
        .string()
        .optional()
        .describe("Optional: id der Elternseite (fuer Unterseiten)."),
    },
  },
  tool(async ({ notebookId, title, markdown, parentId }) => {
    const created = await createPage({ notebookId, parentId, title });
    if (!created || !created.id) {
      throw new Error("Seite wurde angelegt, aber es kam keine id zurueck.");
    }
    await updatePage(created.id, { title, contentMd: markdown });
    return text(
      `Seite erstellt.\npageId: ${created.id}\nTitel: ${title}\nNotizbuch: ${notebookId}${parentId ? `\nEltern: ${parentId}` : ""}`
    );
  })
);

server.registerTool(
  "update_page",
  {
    description:
      "Aktualisiert eine bestehende Seite. markdown und/oder title koennen gesetzt werden (mindestens eines erforderlich). markdown ersetzt den gesamten Inhalt.",
    inputSchema: {
      pageId: z.string().describe("id der zu aktualisierenden Seite."),
      markdown: z
        .string()
        .optional()
        .describe("Neuer Markdown-Inhalt (ersetzt den bisherigen Inhalt komplett)."),
      title: z.string().optional().describe("Neuer Titel."),
    },
  },
  tool(async ({ pageId, markdown, title }) => {
    if (markdown === undefined && title === undefined) {
      throw new Error("Mindestens 'markdown' oder 'title' muss angegeben werden.");
    }
    const res = await updatePage(pageId, { title, contentMd: markdown });
    return text(
      `Seite aktualisiert (${pageId}).${res && res.updatedAt ? ` updatedAt: ${res.updatedAt}` : ""}`
    );
  })
);

server.registerTool(
  "append_to_page",
  {
    description:
      "Liest den aktuellen Inhalt einer Seite, haengt den uebergebenen Markdown-Text an und speichert. Praktisch, um eine Seite zu erweitern, ohne sie zu ueberschreiben.",
    inputSchema: {
      pageId: z.string().describe("id der Seite, die erweitert werden soll."),
      markdown: z.string().describe("Markdown-Text, der angehaengt wird."),
    },
  },
  tool(async ({ pageId, markdown }) => {
    const page = await getPage(pageId);
    const current = page.contentMd ?? "";
    // Sicherstellen, dass zwischen altem und neuem Inhalt eine Leerzeile steht.
    const sep = current.length === 0 ? "" : current.endsWith("\n") ? "\n" : "\n\n";
    const combined = `${current}${sep}${markdown}`;
    const res = await updatePage(pageId, { contentMd: combined });
    return text(
      `Inhalt angehaengt an "${page.title}" (${pageId}).${res && res.updatedAt ? ` updatedAt: ${res.updatedAt}` : ""}`
    );
  })
);

// --- Start ueber stdio ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keine Ausgabe auf stdout (stoert das stdio-Protokoll); Logs nur auf stderr.
  console.error("Erato MCP-Server laeuft (stdio).");
}

main().catch((err) => {
  console.error("Fataler Fehler beim Start des Erato MCP-Servers:", err);
  process.exit(1);
});
