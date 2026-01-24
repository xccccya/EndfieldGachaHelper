# MySQL（本地开发）

## 目标

- 使用你本地的 MySQL 8.4.6
- 创建数据库：`EFGachaHelperDev`

## 初始化数据库

用 MySQL 客户端执行：

```sql
source infra/mysql/init/01-create-db.sql;
```

或在命令行（PowerShell）：

```powershell
mysql -uroot -p -e "source infra/mysql/init/01-create-db.sql"
```

## Prisma 连接串

后端 `apps/api` 使用 `DATABASE_URL`：

示例见 `apps/api/.env.example`（请把密码写到你本地 `.env`，不要提交到仓库）。

