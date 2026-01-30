import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 可选认证守卫
 * 如果提供了有效的 JWT Token，则解析用户信息；否则不做任何处理
 * 适用于公开接口但需要可选获取用户信息的场景（如排行榜的"我的排名"）
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // 调用父类的 canActivate，但不会在失败时抛出错误
    return super.canActivate(context);
  }

  handleRequest<TUser = { id: string; email: string }>(
    err: Error | null,
    user: TUser | false,
  ): TUser | undefined {
    // 如果有错误或没有用户，返回 undefined（而不是抛出错误）
    if (err || !user) {
      return undefined;
    }
    return user;
  }
}
