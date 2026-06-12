import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "未提供认证令牌" },
    });
  }

  try {
    request.user = verifyToken(header.slice(7));
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "令牌无效或已过期" },
    });
  }
}
