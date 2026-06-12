[根目录](../) > **client**

# client 模块

> Spark 的前端 Web 应用，基于 React 19 + TypeScript + Vite 7 构建的移动端优先 SPA。

## 模块职责

这是 Spark 项目的唯一活跃模块，承载全部用户界面与交互逻辑：

- 用户认证（邮箱登录/注册）
- 写作素材（灵感笔记）管理
- 故事创建流程：核心梗概 -> 设定生成 -> 大纲编辑 -> 分章写作
- AI 辅助聊天（内联/半屏/全屏三种模式）
- 故事归档与偏好设置

## 入口与启动

| 文件 | 职责 |
|------|------|
| `index.html` | HTML 入口，引入 Google Fonts (Inter + Noto Serif SC)，挂载 `#root` |
| `src/main.tsx` | React 应用入口，`createRoot` 渲染 `<App />` |
| `src/App.tsx` | 路由配置与全局布局（路由守卫、React Query Provider、底部导航） |
| `vite.config.ts` | Vite 配置：React 插件、路径别名 `@/ -> src/`、移动端视口 |

启动命令：

```bash
npm install && npm run dev   # 开发服务 http://localhost:5173
npm run build                # TypeScript 编译检查 + 生产构建
npm run lint                 # ESLint 检查
```

## 路由结构

| 路径 | 页面组件 | 说明 |
|------|----------|------|
| `/login` | `pages/login.tsx` | 登录/注册 |
| `/materials` | `pages/materials.tsx` | 素材列表（首页） |
| `/stories` | `pages/story-list.tsx` | 故事列表 |
| `/stories/new` | `pages/create-story.tsx` | 创建故事 |
| `/stories/:id/settings` | `pages/setting.tsx` | 设定确认/编辑 |
| `/stories/:id/outline` | `pages/outline.tsx` | 大纲编辑 |
| `/stories/:id/write` | `pages/writing.tsx` | 分章写作（主写作界面） |
| `/settings` | `pages/settings.tsx` | 应用偏好设置 |

- 路由守卫：未登录用户自动跳转 `/login`（`ProtectedRoute` 组件）
- 已登录用户访问 `/login` 自动跳转 `/materials`

## 状态管理 (Zustand)

| Store | 文件 | 职责 |
|-------|------|------|
| `useAuthStore` | `stores/auth-store.ts` | 用户认证、登录/注册/登出、token 持久化 (localStorage) |
| `useMaterialsStore` | `stores/materials-store.ts` | 素材笔记 CRUD、归档、置顶、标签筛选、统计 |
| `useStoryStore` | `stores/story-store.ts` | 故事全生命周期：创建、设定生成、大纲编辑、归档 |
| `useWritingStore` | `stores/writing-store.ts` | 写作界面状态：章节切换、编辑模式、AI 聊天、生成控制 |

所有 Store 目前使用 Mock API (`mocks/api.ts`)，通过 600ms 模拟延迟。

## 数据模型 (`types/index.ts`)

核心类型：

```
User { id, email, nickname, avatarUrl, createdAt }
Material { id, userId, title, content, tags[], isPinned, isArchived, createdAt, updatedAt }
Story { id, userId, premise, status: 'draft'|'generating'|'confirmed'|'outline_done'|'writing'|'completed',
        setting: StorySetting, outline: StoryOutline, sections: StorySection[], archived, createdAt, updatedAt }
StorySetting { characters[], scenes[], era, tone, themes[], conflictSetup? }
StoryOutline { title, synopsis, hook?, ending?, sections: OutlineSection[] }
OutlineSection { id, title, summary, purpose, keyEvents[], emotion, wordCount }
StorySection { id, title, summary, draft?, wordCount, status: 'pending'|'generating'|'draft'|'done' }
ChatMessage { id, role, content, createdAt, type, relatedSectionId?, suggestion? }
```

## 关键组件

### 自定义组件 (`components/`)

| 组件 | 文件 | 说明 |
|------|------|------|
| `BottomNav` | `bottom-nav.tsx` | 底部标签导航（素材、故事、设置） |
| `ChatPanel` | `chat-panel.tsx` | AI 聊天面板，支持折叠/半屏/全屏模式切换 |
| `MobileFrame` | `mobile-frame.tsx` | 桌面端手机模拟器外框（Breakpoint >= md 时显示） |

### shadcn/ui 组件 (`components/ui/`)

Button, Input, Textarea, Label, Card, Badge, Avatar, Tabs, Select, Dialog, DropdownMenu, Popover, Tooltip, Separator, Skeleton, Switch, ScrollArea, Collapsible, Toggle, ToggleGroup, NavigationMenu

## 样式系统

- **Tailwind CSS v4**，通过 `@theme` 指令定义设计令牌（见 `index.css`）
- 配色方案：纯黑白为主色调，红色为破坏性操作色
- 字体：Inter (UI 文本) + Noto Serif SC (正文/内容文本)
- 圆角：`0.625rem`（全局默认）
- 响应式：移动优先，桌面端使用 `MobileFrame` 组件模拟手机视口

## 数据层

当前为纯前端 Mock 模拟：

- `mocks/api.ts` -- 模拟 API 函数：login, register, getMaterials, createMaterial, updateMaterial, archiveMaterial, getStories, createStory, getStory, updateStory 等
- `mocks/data.ts` -- Mock 数据集：1 个用户、5 个素材、2 个故事（含完整设定/大纲/章节/聊天记录）
- 所有数据存储在 Zustand Store 中，刷新页面后通过 Mock 重新初始化

## 测试与质量

- **ESLint 9** flat config (`eslint.config.js`)
  - TypeScript + React Hooks + React Refresh 规则
  - `@/` 路径别名已在 import resolver 中配置
- **TypeScript 5.8** 严格模式（`strict: true`，`noUnusedLocals/noUnusedParameters`）
- 测试框架：**未配置**（无 vitest/jest/testing-library）
- CI/CD：**未配置**

## 相关文件清单

```
client/
  index.html                          # HTML 入口
  package.json                        # 依赖与脚本
  vite.config.ts                      # Vite 构建配置
  tsconfig.json / tsconfig.app.json   # TypeScript 配置
  eslint.config.js                    # ESLint 配置
  components.json                     # shadcn/ui 配置
  src/
    main.tsx                          # React 入口
    App.tsx                           # 路由与全局布局
    index.css                         # Tailwind 主题变量
    types/index.ts                    # 全局类型定义
    lib/utils.ts                      # cn() 工具函数
    mocks/api.ts                      # Mock API 层
    mocks/data.ts                     # Mock 数据
    stores/auth-store.ts              # 认证 Store
    stores/materials-store.ts         # 素材 Store
    stores/story-store.ts             # 故事 Store
    stores/writing-store.ts           # 写作 Store
    components/bottom-nav.tsx         # 底部导航
    components/chat-panel.tsx         # AI 聊天面板
    components/mobile-frame.tsx       # 桌面端手机外框
    components/ui/*.tsx               # shadcn/ui 基础组件
    pages/login.tsx                   # 登录页
    pages/materials.tsx               # 素材列表页
    pages/create-story.tsx            # 创建故事页
    pages/setting.tsx                 # 设定编辑页
    pages/outline.tsx                 # 大纲编辑页
    pages/writing.tsx                 # 主写作页
    pages/story-list.tsx              # 故事列表页
    pages/settings.tsx                # 应用设置页
```

## 常见问题 (FAQ)

**Q: 为什么页面数据刷新后会重置？**
A: 当前使用 Mock API，数据仅存在于 Zustand Store 内存中。`mocks/api.ts` 中的函数每次调用都返回 Mock 数据集的新副本。

**Q: 桌面端访问时为什么显示手机外框？**
A: 这是 `MobileFrame` 组件的设计，当视口宽度 >= 768px (md breakpoint) 时，自动包裹一个 iPhone 样式的外框，保持移动端设计体验。

**Q: 如何接入真实后端？**
A: 需要在 `mocks/api.ts` 中将 Mock 函数替换为真实的 HTTP 请求（推荐使用 fetch/axios），并对接后端 API。Store 层的调用方式无需改变。

## 变更记录 (Changelog)

- **2026-06-12** -- 初始创建模块文档（架构师自动生成）。
