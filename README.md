# nestjs-bff-template

NestJS 后端，提供认证、令牌刷新和积分购买等接口。

## 启动方式
1) 安装依赖：`pnpm install`  
2) 配置环境：`cp .env.example .env` 并按下方变量填写  
3) 开发模式：`pnpm start:dev`  
4) 生产模式：`pnpm build && pnpm start:prod`

> 生成强随机密钥示例：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 或 `openssl rand -hex 32`

## 数据管理（Prisma Studio）
- 依赖同一个 `DATABASE_URL`，不会修改表结构。
- 启动：`pnpm prisma:studio`，浏览器打开提示的本地端口（默认 http://localhost:5555）。
- 当前 schema 映射了 `users` 与 `purchases`，可直接查看/编辑记录。
