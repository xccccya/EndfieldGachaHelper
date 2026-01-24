import type { FastifyRequest } from 'fastify';

// 预留：后续扩展 Auth 相关公共类型（例如 token 响应结构、用户公开字段等）
export type PublicUser = {
  id: string;
  email: string;
};

// JWT 认证后的请求类型
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
  };
}

