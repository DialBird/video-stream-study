import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      
      // Replace environment variable placeholders in HTML
      const envVars = {
        VITE_APP_TITLE: process.env.VITE_APP_TITLE || "Video Stream Study",
        VITE_APP_LOGO: process.env.VITE_APP_LOGO || "https://placehold.co/128x128/E1E7EF/1F2937?text=App",
        VITE_ANALYTICS_ENDPOINT: process.env.VITE_ANALYTICS_ENDPOINT || "",
        VITE_ANALYTICS_WEBSITE_ID: process.env.VITE_ANALYTICS_WEBSITE_ID || "",
      };
      
      // Replace placeholders with actual values
      template = template.replace(/%VITE_APP_TITLE%/g, envVars.VITE_APP_TITLE);
      template = template.replace(/%VITE_APP_LOGO%/g, envVars.VITE_APP_LOGO);
      
      // Replace analytics placeholders or remove script if not configured
      if (!envVars.VITE_ANALYTICS_ENDPOINT || !envVars.VITE_ANALYTICS_WEBSITE_ID) {
        // Remove the entire analytics script tag if not configured (handles multiline)
        template = template.replace(
          /<script\s+defer[\s\S]*?%VITE_ANALYTICS_ENDPOINT%[\s\S]*?%VITE_ANALYTICS_WEBSITE_ID%[\s\S]*?><\/script>/g,
          ""
        );
      } else {
        template = template.replace(/%VITE_ANALYTICS_ENDPOINT%/g, envVars.VITE_ANALYTICS_ENDPOINT);
        template = template.replace(/%VITE_ANALYTICS_WEBSITE_ID%/g, envVars.VITE_ANALYTICS_WEBSITE_ID);
      }
      
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
