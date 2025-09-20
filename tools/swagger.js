// tools/swagger.js
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveSpecPath(projectRootDir = null) {
  const root = projectRootDir || path.resolve(__dirname, "..");
  const candidates = [
    path.join(root, "docs", "openapi.yaml"), // հին տեղադրումը
    path.join(root, "docs", "openapi.yml"),
    path.join(__dirname, "swagger.yaml"),    // նոր տեղադրումը
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  const tried = candidates.map((p) => `- ${p}`).join("\n");
  throw new Error(
    `Swagger spec file not found. Tried:\n${tried}\n` +
      `Place your OpenAPI file at one of the paths above.`
  );
}

/**
 * Mounts Swagger UI at /docs and serves the spec file with no-cache headers.
 * Result: refreshing /docs will always reflect the latest YAML without server restart.
 */
export function mountSwagger(app, projectRootDir = null) {
  const specPath = resolveSpecPath(projectRootDir);
  const root = projectRootDir || path.resolve(__dirname, "..");

  // Always expose the spec under a stable URL so swagger-ui fetches it dynamically
  const specUrl = "/docs/openapi.yaml";

  // Serve the YAML with no-cache so edits are picked up immediately
  app.get(specUrl, (req, res) => {
    res.setHeader("Content-Type", "application/yaml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(specPath);
  });

  // Mount Swagger UI; point it to the URL above (not an in-memory object)
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
      customSiteTitle: "inLobby API Docs",
      swaggerOptions: {
        url: specUrl, // ⬅️ dynamic load (no restart needed)
        supportedSubmitMethods: ["get", "post", "put", "patch", "delete", "options"],
        displayRequestDuration: true,
      },
    })
  );

  console.log(
    `📘 Swagger UI mounted at /docs (spec: ${path.relative(root, specPath)})`
  );
}