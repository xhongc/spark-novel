import path from "node:path";
import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authGuard } from "../plugins/auth.js";
import { refreshPiAgentModelRegistry } from "../lib/pi-agent.js";

const AGENT_DIR = path.resolve(process.cwd(), "workspace", ".pi", "agent");
const MODELS_JSON_PATH = path.join(AGENT_DIR, "models.json");
const SETTINGS_JSON_PATH = path.join(AGENT_DIR, "settings.json");

const modelCostSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
});

const reasoningEffortMapSchema = z.object({
  minimal: z.string().optional(),
  low: z.string().optional(),
  medium: z.string().optional(),
  high: z.string().optional(),
  xhigh: z.string().optional(),
});

const compatSchema = z.object({
  requiresReasoningContentOnAssistantMessages: z.boolean().optional(),
  thinkingFormat: z.string().optional(),
  reasoningEffortMap: reasoningEffortMapSchema.optional(),
}).passthrough();

const modelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  contextWindow: z.number().int().nonnegative().optional(),
  maxTokens: z.number().int().nonnegative().optional(),
  input: z.array(z.enum(["text", "image"])).min(1),
  reasoning: z.boolean().optional(),
  cost: modelCostSchema.optional(),
  compat: compatSchema.optional(),
});

const providerSchema = z.object({
  baseUrl: z.string().min(1).optional(),
  api: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  models: z.array(modelSchema),
}).passthrough();

const modelsConfigSchema = z.object({
  providers: z.record(z.string(), providerSchema),
});

const settingsConfigSchema = z.object({
  lastChangelogVersion: z.string().optional(),
  defaultProvider: z.string().min(1),
  defaultModel: z.string().min(1),
  defaultThinkingLevel: z.string().optional(),
}).passthrough();

const agentConfigSchema = z.object({
  models: modelsConfigSchema,
  settings: settingsConfigSchema,
});

async function ensureAgentDir(): Promise<void> {
  await fs.mkdir(AGENT_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

function validateDefaultModel(
  models: z.infer<typeof modelsConfigSchema>,
  settings: z.infer<typeof settingsConfigSchema>,
): void {
  const provider = models.providers[settings.defaultProvider];
  if (!provider) {
    throw new Error("默认 provider 不存在");
  }

  const hasDefaultModel = provider.models.some((model) => model.id === settings.defaultModel);
  if (!hasDefaultModel) {
    throw new Error("默认 model 不存在");
  }
}

export async function agentConfigRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onRequest", authGuard);

  fastify.get("/agent/config", async (_req, reply) => {
    try {
      await ensureAgentDir();

      const models = modelsConfigSchema.parse(await readJsonFile(MODELS_JSON_PATH, { providers: {} }));
      const settings = settingsConfigSchema.parse(await readJsonFile(SETTINGS_JSON_PATH, {
        defaultProvider: "",
        defaultModel: "",
      }));

      return reply.send({
        success: true,
        data: { models, settings },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取配置失败";
      return reply.status(500).send({
        success: false,
        error: { code: "AGENT_CONFIG_READ_FAILED", message },
      });
    }
  });

  fastify.put("/agent/config", async (req, reply) => {
    try {
      await ensureAgentDir();

      const payload = agentConfigSchema.parse(req.body);
      validateDefaultModel(payload.models, payload.settings);

      await fs.writeFile(MODELS_JSON_PATH, `${JSON.stringify(payload.models, null, 2)}\n`, "utf-8");
      await fs.writeFile(SETTINGS_JSON_PATH, `${JSON.stringify(payload.settings, null, 2)}\n`, "utf-8");
      refreshPiAgentModelRegistry();

      return reply.send({
        success: true,
        data: payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存配置失败";
      return reply.status(400).send({
        success: false,
        error: { code: "AGENT_CONFIG_SAVE_FAILED", message },
      });
    }
  });
}
