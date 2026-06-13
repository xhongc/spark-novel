import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { authRoutes } from "./routes/auth.js";
import { storyRoutes } from "./routes/stories.js";
import { generateRoutes } from "./routes/generate.js";
import { materialsRoutes } from "./routes/materials.js";
import { skillRoutes } from "./routes/skills.js";
import { assistantRoutes } from "./routes/assistant.js";
import { agentConfigRoutes } from "./routes/agent-config.js";
import { storyWorkspaceRoutes } from "./routes/story-workspace.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  // CORS
  await app.register(cors, {
    origin: ["http://localhost:5173"],
    credentials: true,
  });

  // 插件
  await app.register(registerErrorHandler);

  // 路由
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(storyRoutes, { prefix: "/api/v1" });
  await app.register(storyWorkspaceRoutes, { prefix: "/api/v1" });
  await app.register(generateRoutes, { prefix: "/api/v1" });
  await app.register(materialsRoutes, { prefix: "/api/v1" });
  await app.register(skillRoutes, { prefix: "/api/v1" });
  await app.register(assistantRoutes, { prefix: "/api/v1" });
  await app.register(agentConfigRoutes, { prefix: "/api/v1" });

  // 健康检查
  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
