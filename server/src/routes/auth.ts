import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcryptjs from "bcryptjs";
const { hash, compare } = bcryptjs;
import { prisma } from "../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/jwt.js";
import { authGuard } from "../plugins/auth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(1).max(50),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // 注册
  fastify.post("/auth/register", async (req, reply) => {
    const { email, password, nickname } = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "邮箱已注册" },
      });
    }

    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, nickname },
    });

    const payload = { userId: user.id, email: user.email };
    return {
      success: true,
      data: {
        user: { id: user.id, email: user.email, nickname: user.nickname },
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload),
      },
    };
  });

  // 登录
  fastify.post("/auth/login", async (req, reply) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await compare(password, user.passwordHash))) {
      return reply.status(401).send({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" },
      });
    }

    const payload = { userId: user.id, email: user.email };
    return {
      success: true,
      data: {
        user: { id: user.id, email: user.email, nickname: user.nickname },
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload),
      },
    };
  });

  // 刷新 Token
  fastify.post("/auth/refresh", async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return reply.status(400).send({
        success: false,
        error: { code: "MISSING_TOKEN", message: "缺少 refreshToken" },
      });
    }

    try {
      const payload = verifyToken(refreshToken);
      const newPayload = { userId: payload.userId, email: payload.email };
      return {
        success: true,
        data: {
          accessToken: signAccessToken(newPayload),
          refreshToken: signRefreshToken(newPayload),
        },
      };
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: "INVALID_TOKEN", message: "refreshToken 无效或已过期" },
      });
    }
  });

  // 获取当前用户
  fastify.get("/auth/me", { preHandler: [authGuard] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });
    if (!user) {
      throw new Error("User not found");
    }
    return {
      success: true,
      data: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt },
    };
  });
}
