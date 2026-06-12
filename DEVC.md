# 短篇写作助手 — 全栈开发需求文档

> 版本：v1.1 | 日期：2026-06-12

---

## 一、项目概述

### 1.1 产品定义

一个 AI 辅助短篇小说写作 Web 应用。用户输入故事创意，AI 自动生成故事设定、分章大纲和章节正文，用户通过审核-编辑-确认的闭环完成一部完整的短篇小说。

### 1.2 核心用户流程

```
输入创意 → AI 生成设定 → 用户确认/修改 → AI 生成大纲 → 用户确认/调整
→ AI 逐章生成正文 → 用户审核/编辑 → 完成全部章节 → 故事完成
```

### 1.3 已确认的技术决策

| 决策项 | 选型 |
|--------|------|
| 前端框架 | React 18 + TypeScript + Vite |
| 样式方案 | Tailwind CSS |
| UI 组件库 | shadcn/ui |
| 前端状态管理 | Zustand |
| 后端框架 | Fastify 5 + TypeScript |
| 数据库 | SQLite（Prisma，开发阶段零配置） |
| ORM | Prisma 6（provider: sqlite） |
| 认证 | JWT（Access + Refresh Token） |
| AI 集成 | pi Agent SDK（`@earendil-works/pi-coding-agent`） |
| 实时通信 | SSE（全场景使用，不需要 WebSocket） |
| API 风格 | RESTful，前缀 `/api/v1` |
| 并发控制 | 串行生成（一次一个章节） |

---

## 二、项目目录结构

```
spark/
├── client/                          # 前端项目
│   ├── src/
│   │   ├── app/                     # 路由与页面入口
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # 重定向逻辑
│   │   │   ├── (auth)/              # 无鉴权路由组
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   └── (app)/               # 需鉴权路由组
│   │   │       ├── stories/
│   │   │       │   ├── page.tsx          # 故事列表
│   │   │       │   ├── new/page.tsx      # 创建故事
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx              # 写作主界面
│   │   │       │       ├── setting/page.tsx      # 设定确认页
│   │   │       │       └── outline/page.tsx      # 大纲确认页
│   │   │       └── _components/       # 共享布局组件
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui 组件
│   │   │   ├── auth/                # 登录/注册表单
│   │   │   ├── story/               # 故事相关组件
│   │   │   │   ├── story-card.tsx
│   │   │   │   ├── story-form.tsx
│   │   │   │   ├── setting-card.tsx
│   │   │   │   └── outline-item.tsx
│   │   │   └── writing/             # 写作界面组件
│   │   │       ├── top-bar.tsx
│   │   │       ├── content-area.tsx
│   │   │       ├── bottom-bar.tsx
│   │   │       ├── chat-panel.tsx
│   │   │       ├── section-drawer.tsx
│   │   │       ├── diff-viewer.tsx
│   │   │       └── skeleton-screen.tsx
│   │   ├── stores/
│   │   │   ├── auth-store.ts
│   │   │   ├── story-store.ts
│   │   │   └── writing-store.ts
│   │   ├── lib/
│   │   │   ├── api-client.ts        # Axios 封装 + 拦截器
│   │   │   ├── sse-client.ts        # SSE 流式请求封装
│   │   │   └── utils.ts
│   │   └── types/
│   │       └── index.ts             # 全局类型定义
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── components.json              # shadcn/ui 配置
│
├── server/                          # 后端项目
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── dev.db                   # SQLite 数据库文件（gitignore）
│   ├── src/
│   │   ├── config/
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   ├── prisma.ts
│   │   │   ├── jwt.ts
│   │   │   ├── api-response.ts
│   │   │   ├── state-machine.ts
│   │   │   ├── pi-agent.ts          # pi Agent SDK 封装（会话管理 + 流式调用）
│   │   │   └── prompt-manager.ts
│   │   ├── plugins/
│   │   │   ├── auth-guard.ts
│   │   │   ├── error-handler.ts
│   │   │   ├── cors.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── swagger.ts
│   │   ├── prompts/
│   │   │   ├── setting-generation.ts
│   │   │   ├── outline-generation.ts
│   │   │   ├── section-writing.ts
│   │   │   ├── section-rewrite.ts
│   │   │   └── section-modify.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   └── auth.schema.ts
│   │   │   ├── story/
│   │   │   │   ├── story.routes.ts
│   │   │   │   ├── story.service.ts
│   │   │   │   ├── story.controller.ts
│   │   │   │   └── story.schema.ts
│   │   │   ├── section/
│   │   │   │   ├── section.routes.ts
│   │   │   │   ├── section.service.ts
│   │   │   │   ├── section.controller.ts
│   │   │   │   └── section.schema.ts
│   │   │   └── generation/
│   │   │       ├── generation.routes.ts
│   │   │       ├── generation.schema.ts
│   │   │       └── services/
│   │   │           ├── setting.service.ts
│   │   │           ├── outline.service.ts
│   │   │           ├── writing.service.ts
│   │   │           ├── rewrite.service.ts
│   │   │           ├── stream-handler.ts
│   │   │           └── generation-log.service.ts
│   │   ├── types/
│   │   │   ├── common.ts
│   │   │   └── fastify.d.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
└── DEVC.md                          # 本文档
```

---

## 三、数据库设计（SQLite + Prisma）

### 3.1 ER 关系

```
User 1 ──* Story
Story 1 ──* Section
Story 1 ──* GenerationLog
Section 1 ──* GenerationLog
```

### 3.2 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  nickname     String
  avatarUrl    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  stories        Story[]
  generationLogs GenerationLog[]

  @@map("users")
}

model Story {
  id               String   @id @default(cuid())
  userId           String
  title            String
  premise          String
  stage            String   @default("setting")   // setting | outline | writing | completed
  setting          String?  // JSON 字符串
  genre            String?
  targetWordCount  Int?
  currentWordCount Int      @default(0)
  isDeleted        Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  user             User     @relation(fields: [userId], references: [id])
  sections         Section[]
  generationLogs   GenerationLog[]

  @@index([userId])
  @@index([stage])
  @@map("stories")
}

model Section {
  id               String   @id @default(cuid())
  storyId          String
  title            String
  summary          String?
  content          String?
  wordCount        Int      @default(0)
  targetWordCount  Int?
  sortOrder        Int
  status           String   @default("locked")    // locked | review | editing | completed
  aiModel          String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  story            Story    @relation(fields: [storyId], references: [id])
  generationLogs   GenerationLog[]

  @@index([storyId])
  @@index([storyId, sortOrder])
  @@map("sections")
}

model GenerationLog {
  id               String   @id @default(cuid())
  userId           String
  storyId          String
  sectionId        String?
  type             String   // setting | outline | section_write | section_rewrite | section_modify
  model            String
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  durationMs       Int      @default(0)
  status           String   @default("pending")   // pending | streaming | completed | failed
  errorMessage     String?
  createdAt        DateTime @default(now())

  user             User     @relation(fields: [userId], references: [id])
  story            Story    @relation(fields: [storyId], references: [id])
  section          Section? @relation(fields: [sectionId], references: [id])

  @@index([userId])
  @@index([storyId])
  @@map("generation_logs")
}
```

> **注意**：SQLite 不支持 ENUM 和 JSONB，使用 String + 注释标注合法值。`setting` 字段存储 JSON 字符串，应用层做 parse/stringify。使用 `cuid()` 替代 `uuid()`（SQLite 无原生 UUID）。

### 3.3 状态机

**故事阶段流转：**

```
setting → outline → writing → completed
```

**章节状态流转：**

```
locked ──→ review ──→ editing ──→ completed
           ↑    │
           └────┘  (可回退)
```

- `locked → review`：AI 生成完成后自动进入
- `review → editing`：用户选择编辑
- `editing → completed`：用户确认完成
- `review → locked`：用户要求重新生成
- `editing → review`：回退审核

---

## 四、API 接口设计

### 4.1 通用响应格式

```json
// 成功
{ "success": true, "data": { ... }, "message": "操作成功" }

// 错误
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "邮箱格式不正确" } }

// 分页
{ "success": true, "data": { "items": [...], "total": 100, "page": 1, "pageSize": 20, "totalPages": 5 } }
```

### 4.2 认证模块 `/api/v1/auth`

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/register` | 注册（email + password + nickname） | 无 |
| POST | `/login` | 登录（email + password） | 无 |
| POST | `/refresh` | 刷新 Token | Refresh Token |
| GET | `/me` | 当前用户信息 | Access Token |
| PUT | `/me` | 更新用户信息 | Access Token |

登录/注册返回：
```json
{
  "user": { "id": "cuid", "email": "...", "nickname": "..." },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 7200
}
```

### 4.3 故事模块 `/api/v1/stories`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/` | 创建故事（title, premise, genre, targetWordCount） |
| GET | `/` | 列表（分页、按 stage 筛选） |
| GET | `/:id` | 详情（含章节列表） |
| PUT | `/:id` | 更新故事 |
| DELETE | `/:id` | 软删除 |

### 4.4 章节模块 `/api/v1/stories/:storyId/sections`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 章节列表 |
| GET | `/:id` | 章节详情 |
| PUT | `/:id` | 更新（标题/内容） |
| PUT | `/:id/status` | 更新状态 |
| PUT | `/reorder` | 重新排序 |
| POST | `/` | 手动添加 |
| DELETE | `/:id` | 删除章节 |

### 4.5 AI 生成模块 `/api/v1/generate`

| 方法 | 路径 | 说明 | 响应 |
|------|------|------|------|
| POST | `/setting` | 生成故事设定 | JSON |
| POST | `/outline` | 生成大纲 | JSON |
| POST | `/section` | 生成章节正文 | SSE 流 |
| POST | `/section/:id/rewrite` | 重写章节 | SSE 流 |
| POST | `/section/:id/modify` | 修改章节 | SSE 流 |
| GET | `/logs` | 生成历史 | JSON 分页 |

**SSE 流格式：**

```
event: progress
data: {"type":"start","sectionId":"cuid"}

event: chunk
data: {"type":"content","text":"林远睁开眼睛，"}

event: chunk
data: {"type":"content","text":"映入眼帘的是一片陌生的星空..."}

event: done
data: {"type":"complete","sectionId":"cuid","wordCount":2500}
```

### 4.6 AI 聊天（Agent）`/api/v1/agent`

Agent 对话使用 **SSE 流式 REST 接口**（无 WebSocket）：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/chats` | 创建对话 |
| GET | `/chats` | 对话列表 |
| GET | `/chats/:chatId/messages` | 历史消息（分页） |
| DELETE | `/chats/:chatId` | 删除对话 |
| POST | `/chats/:chatId/messages` | 发送消息（SSE 流式返回 AI 回复） |

---

## 五、前端页面设计

### 5.1 页面路由总览

| 路径 | 页面 | 功能 |
|------|------|------|
| `/login` | 登录 | 邮箱+密码登录，切换注册 |
| `/stories` | 故事列表 | 书架式卡片列表 |
| `/stories/new` | 创建故事 | 输入故事前提 |
| `/stories/:id/setting` | 设定确认 | 展示/编辑 AI 生成的设定 |
| `/stories/:id/outline` | 大纲确认 | 展示/编辑/排序大纲 |
| `/stories/:id` | 写作主界面 | 核心：阅读/编辑/审核章节 |

### 5.2 状态管理（Zustand）

**authStore**
- 用户信息、Token
- login / register / logout / refreshToken

**storyStore**
- 故事列表、当前故事（含设定、章节列表）
- createStory / fetchStories / fetchStory / updateSetting / updateOutline / updateSectionStatus

**writingStore**
- 当前小节索引、编辑模式、选中文字
- 对话框状态（收起/半屏/全屏）、抽屉状态、diff 预览
- setSectionIndex / toggleEdit / openChat / closeChat

### 5.3 核心页面交互说明

#### 写作主界面（`/stories/:id`）

**五个区域：**

1. **顶部栏**（48px，半透明）
   - 左：返回按钮
   - 中：当前小节标题，点击展开导航抽屉
   - 右：状态标签（🔵生成中 🟡待审核 🔴需修改 🟢已完成 🔒未解锁）

2. **正文区域**（占满剩余空间）
   - 阅读模式：上下滑动阅读，左右滑动切换小节，行高1.8，16px
   - 编辑模式：可编辑文本区，键盘弹起自动上移，禁用左右滑
   - 修改预览：原文红色删除线 + 新文绿色高亮
   - 未解锁：锁图标 + "请先完成前一节"
   - 生成中：骨架屏 + "AI 正在为你创作..."

3. **底部栏**
   - 左：◀ §2 │ 3/8 │ §4 ▶ 小节导航
   - 右：操作按钮（根据状态动态变化）

   | 当前状态 | 按钮 |
   |---------|------|
   | locked | "本节未解锁" |
   | 未生成 | [生成正文] |
   | 生成中 | ⏳ 生成中 [取消] |
   | review | [编辑] [重生成] [需修改] [完成] |
   | editing | [编辑] [重生成] [完成] |
   | completed | [编辑] [解锁修改] |

4. **浮层对话框**
   - 收起态：右下角浮动 💬 按钮，有新消息红点
   - 半屏态：底部弹出 40% 高度，消息列表 + 输入框
   - 全屏态：占满屏幕，用于复杂对话
   - 输入框上方快捷按钮：[扩写] [缩写] [润色] [改写对白] [环境描写]
   - 选中文字自动带入上下文

5. **小节导航抽屉**
   - 呼出：点击标题 / 正文下拉
   - 内容：小节列表（标题、字数、状态、高亮当前节）
   - 底部：[回顾设定] [返回大纲编辑]

### 5.4 响应式策略

| 断点 | 布局 |
|------|------|
| < 768px（手机） | 单列，全屏沉浸，对话框半屏/全屏 |
| 768-1024px（平板） | 正文居中 max-width 600px，对话框可侧边 |
| > 1024px（桌面） | 三栏：左侧导航、中间正文、右侧对话框 |

---

## 六、AI 集成设计（pi Agent SDK）

### 6.1 pi Agent SDK 核心概念

使用 `@earendil-works/pi-coding-agent` SDK，通过 `createAgentSession()` 创建会话，`session.prompt()` 发送指令，`session.subscribe()` 接收流式输出。

```typescript
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@earendil-works/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

// 订阅流式输出
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// 发送 prompt
await session.prompt("根据以下设定生成故事大纲...");
```

### 6.2 后端 pi Agent 封装（`lib/pi-agent.ts`）

后端封装一个 `PiAgentService`，负责：

1. **会话生命周期管理**：创建/销毁 `AgentSession`，避免内存泄漏
2. **Prompt 注入**：将系统 prompt + 业务数据组装后调用 `session.prompt()`
3. **流式输出桥接**：将 pi Agent 的 `text_delta` 事件转发为 SSE `chunk` 事件
4. **模型选择**：通过 `ModelRegistry` 按场景配置不同模型

```typescript
// lib/pi-agent.ts 核心接口
class PiAgentService {
  // 创建新会话（每次生成任务创建一个，完成后 dispose）
  async createSession(options?: { model?: string; systemPrompt?: string }): Promise<AgentSession>;

  // 非流式调用（用于设定/大纲生成，返回完整 JSON）
  async complete(prompt: string, options?: AgentOptions): Promise<{ content: string; usage: Usage }>;

  // 流式调用（用于章节生成，返回 AsyncGenerator）
  async *stream(prompt: string, options?: AgentOptions): AsyncGenerator<{ text: string }>;

  // 获取可用模型列表
  async getAvailableModels(): Promise<Model[]>;
}
```

### 6.3 架构

```
Generation Service
├── Setting Service      → PiAgentService.complete() → 设定 JSON
├── Outline Service      → PiAgentService.complete() → 大纲 JSON
├── Writing Service      → PiAgentService.stream()   → 章节正文（SSE 流）
├── Rewrite Service      → PiAgentService.stream()   → 重写正文（SSE 流）
└── Generation Log Service → 记录 Token/耗时
         │
    ┌────┴─────────────┐
    │  PiAgentService   │  ← pi Agent SDK 封装
    │  (lib/pi-agent.ts)│
    └──────────────────┘
```

### 6.4 SSE 流式生成桥接

```typescript
// stream-handler.ts
export async function handleStreamGeneration(
  reply: FastifyReply,
  piAgent: PiAgentService,
  prompt: string,
  options?: { onStart?: () => Promise<void>; onDone?: (text: string) => Promise<void> }
) {
  // 设置 SSE 响应头
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  reply.raw.write(`event: progress\ndata: {"type":"start"}\n\n`);

  let fullText = '';
  for await (const chunk of piAgent.stream(prompt)) {
    fullText += chunk.text;
    reply.raw.write(`event: chunk\ndata: ${JSON.stringify({ type: 'content', text: chunk.text })}\n\n`);
  }

  await options?.onDone?.(fullText);
  reply.raw.write(`event: done\ndata: ${JSON.stringify({ type: 'complete', wordCount: fullText.length })}\n\n`);
  reply.raw.end();
}
```

### 6.5 Prompt 模板

| 模板 | 输入 | 输出格式 | 调用方式 |
|------|------|---------|---------|
| setting-generation | premise + genre | JSON | `PiAgentService.complete()` |
| outline-generation | 设定 + 目标字数 | JSON | `PiAgentService.complete()` |
| section-writing | 设定 + 大纲 + 前文摘要 | 文本流 | `PiAgentService.stream()` |
| section-rewrite | 设定 + 当前内容 + 用户指令 | 文本流 | `PiAgentService.stream()` |
| section-modify | 当前内容 + 用户指令 | 文本流 | `PiAgentService.stream()` |

### 6.6 Agent 对话（写作助手）

Agent 对话同样通过 pi Agent SDK 实现，每个对话创建独立 session：

```typescript
// 创建对话时创建 session，保存 sessionId 映射
const session = await piAgent.createSession({
  systemPrompt: "你是一位专业的写作助手，帮助用户完善小说内容..."
});

// 用户发消息
await session.prompt(userMessage);

// 流式返回 AI 回复（通过 SSE）
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    sseWrite({ type: 'content', text: event.assistantMessageEvent.delta });
  }
});
```

---

## 七、认证流程

### 7.1 双 Token 机制

| Token | 有效期 | 存储 | 用途 |
|-------|--------|------|------|
| Access Token | 2 小时 | localStorage | API 请求 |
| Refresh Token | 7 天 | localStorage | 刷新 Access Token |

### 7.2 前端 Token 管理

```
1. 登录 → 存储 accessToken + refreshToken
2. API 请求 → Header 携带 accessToken
3. 401 响应 → 用 refreshToken 请求新 Token → 重试原请求
4. refreshToken 也过期 → 跳转登录页
```

---

## 八、空状态与异常处理

| 场景 | 处理方式 |
|------|---------|
| 故事列表为空 | 居中 "还没有故事" + 大 "+" 按钮 |
| 章节生成失败 | "生成失败，请重试" + [重新生成] |
| 网络断开 | 顶部黄色提示条，编辑内容暂存本地 |
| AI 超时 | "生成时间较长..." + [取消] |
| 未解锁章节 | 锁图标 + "请先完成前一节" + [回到上一节] |

---

## 九、开发阶段划分

### 阶段一：基础设施（3 天）

| # | 任务 | 涉及模块 | 交付物 |
|---|------|---------|--------|
| 1.1 | 前端项目初始化（Vite + React + TS + Tailwind + shadcn/ui） | client | 可运行的空项目 |
| 1.2 | 后端项目初始化（Fastify + TS + Prisma SQLite） | server | /health 端点可用 |
| 1.3 | 数据库 Schema + `prisma migrate dev` | server/prisma | 4 张表创建完成 |
| 1.4 | 全局错误处理 + 统一响应格式 | server/plugins, lib | 错误中间件可用 |
| 1.5 | CORS + 限流 + 请求日志 | server/plugins | 安全可观测 |
| 1.6 | API 客户端封装（Axios + 拦截器） | client/lib | api-client.ts |

### 阶段二：认证模块（2 天）

| # | 任务 | 交付物 |
|---|------|--------|
| 2.1 | 注册/登录后端接口 | auth.routes.ts + service + schema |
| 2.2 | JWT 工具 + 鉴权中间件 | jwt.ts + auth-guard.ts |
| 2.3 | Token 刷新接口 | refresh 端点 |
| 2.4 | 登录/注册前端页面 | /login 页面 + 表单组件 |
| 2.5 | authStore + 路由守卫 | auth-store.ts + 路由保护 |
| 2.6 | 自动刷新 Token + 401 处理 | api-client 拦截器 |

### 阶段三：故事管理（3 天）

| # | 任务 | 交付物 |
|---|------|--------|
| 3.1 | 故事 CRUD 后端接口 | story.routes.ts + service |
| 3.2 | 章节 CRUD 后端接口 | section.routes.ts + service |
| 3.3 | 章节状态机 | state-machine.ts + status 端点 |
| 3.4 | 故事列表前端页面 | /stories + story-card 组件 |
| 3.5 | 创建故事前端页面 | /stories/new + story-form |
| 3.6 | storyStore | story-store.ts |

### 阶段四：AI 生成引擎（5 天）

| # | 任务 | 交付物 |
|---|------|--------|
| 4.1 | pi Agent SDK 封装（PiAgentService） | lib/pi-agent.ts |
| 4.2 | Prompt 模板管理 | prompt-manager.ts + 5 个模板 |
| 4.3 | 生成设定接口 + 前端页面 | setting 生成 + /setting 页面 |
| 4.4 | 生成大纲接口 + 前端页面 | outline 生成 + /outline 页面 |
| 4.5 | SSE 流式生成章节接口 | stream-handler.ts + writing.service |
| 4.6 | 重写/修改章节接口 | rewrite.service.ts |
| 4.7 | 生成日志记录 | generation-log.service |
| 4.8 | 前端 SSE 客户端封装 | sse-client.ts |

### 阶段五：写作主界面（5 天）

| # | 任务 | 交付物 |
|---|------|--------|
| 5.1 | 写作主界面框架（顶部栏+正文+底部栏） | page.tsx + 三大组件 |
| 5.2 | 正文阅读模式（上下滑+左右切节） | content-area.tsx |
| 5.3 | 正文编辑模式 | 编辑切换 + 键盘适配 |
| 5.4 | 底部操作栏（状态动态按钮） | bottom-bar.tsx |
| 5.5 | 小节导航抽屉 | section-drawer.tsx |
| 5.6 | 浮层对话框（半屏/全屏/收起） | chat-panel.tsx |
| 5.7 | SSE 接入 + 骨架屏 | 生成中状态处理 |
| 5.8 | 修改预览（diff 高亮） | diff-viewer.tsx |
| 5.9 | writingStore | writing-store.ts |

### 阶段六：Agent 对话（2 天）

| # | 任务 | 交付物 |
|---|------|--------|
| 6.1 | Agent 对话后端（pi Agent session + SSE） | agent.routes.ts + service |
| 6.2 | 快捷操作按钮 + 选中文字上下文 | chat-panel 增强 |
| 6.3 | 对话历史持久化与加载 | 消息分页接口 |

### 阶段七：收尾优化（3 天）

| # | 任务 | 交付物 |
|---|------|--------|
| 7.1 | 响应式适配（平板/桌面三栏布局） | 媒体查询 + 布局组件 |
| 7.2 | 空状态与异常状态处理 | 各页面空/错状态 |
| 7.3 | API 文档（Swagger） | swagger.ts |
| 7.4 | 单元测试 + 集成测试 | 核心逻辑覆盖 |
| 7.5 | .env.example + 启动脚本 | 项目可一键运行 |

**总计：约 23 个工作日**

---

## 十、技术约束与注意事项

1. **前端所有 API 请求必须经过 api-client.ts**，统一处理 Token、错误、重试
2. **SSE 请求不经过 Axios**，使用原生 `fetch` + `ReadableStream` 封装
3. **所有 AI 生成操作必须串行**，后端需实现锁机制防止并发生成同一故事的多个章节
4. **章节内容变更后自动更新 `current_word_count`**，在 writing.service 中计算
5. **软删除**：故事删除使用 `is_deleted` 标记，不物理删除
6. **排序一致性**：章节排序使用 `sort_order` 整数字段，重排时批量更新
7. **Token 安全**：Refresh Token 使用 rotation 策略，每次刷新签发新的 Refresh Token
8. **SSE 错误处理**：流式传输中如果 AI 报错，发送 `event: error` 后关闭连接，前端提示重试
9. **pi Agent session 生命周期**：每次生成任务创建 session，完成后必须 `session.dispose()` 避免内存泄漏
10. **SQLite 注意事项**：不支持并发写入，需确保写操作串行；`dev.db` 加入 `.gitignore`
