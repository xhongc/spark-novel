import type { FastifyInstance } from "fastify";
import type { FastifyError } from "fastify";

export async function registerErrorHandler(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err.name === "ZodError") {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "请求参数错误",
          details: JSON.parse(err.message),
        },
      });
    }

    if (err.statusCode && err.statusCode < 500) {
      return reply.status(err.statusCode).send({
        success: false,
        error: { code: "BAD_REQUEST", message: err.message },
      });
    }

    fastify.log.error(err);
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
    });
  });
}
