import { createServer } from "node:http";
import { generateAndPresign } from "./media_workflow.js";

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/media") { res.writeHead(404); res.end("Not found"); return; }
  try {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const result = await generateAndPresign(JSON.parse(raw));
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result));
  } catch (error) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: (error as Error).message })); }
});
server.listen(Number(process.env.PORT ?? 3000), () => console.log("media service listening on http://localhost:3000/media"));
