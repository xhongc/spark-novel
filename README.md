# Spark-Novel

Spark Novel 是一个面向短篇故事与小说创作的 AI 写作工作台。
一触灵感，片刻成文，通勤间隙，写完一篇精彩短小说，零碎时光，用短篇填满趣味

它把创作过程中常见的几个核心环节放到同一个界面里：整理素材、沉淀技能、创建故事、推进设定与大纲、进入正文写作，并通过模型配置与 AI 助手协同完成日常创作流程。

适合这样的使用方式：

- 用素材库长期积累世界观、人物、设定和参考片段
- 用技能库沉淀可复用的提示词、工作流和创作方法
- 用故事工作区管理从灵感到正文的完整创作过程
- 用统一入口组织多篇作品，而不是在多个工具之间来回切换

## Quick Start

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd spark
```

### 2. 安装依赖

```bash
cd client && npm install
cd ../server && npm install
```

### 3. 启动服务端

```bash
cd server
npm run dev
```

### 4. 启动客户端

新开一个终端窗口：

```bash
cd client
npm run dev
```

### 5. 打开应用

默认访问地址：

```text
http://localhost:5173
```

如果你需要初始化数据库或更新数据结构，可以在 `server/` 目录下执行：

```bash
npm run db:migrate
npm run db:generate
```

## Screenshots

你可以把项目预览图放在这里，建议在仓库中建立 `docs/images/` 目录统一管理。

示例写法：

```md
## Screenshots

![Materials](docs/images/materials.png)
![Story Workspace](docs/images/story-workspace.png)
![Writing](docs/images/writing.png)
```

如果暂时还没有截图，也可以先保留下面这个结构：

```text
docs/images/materials.png
docs/images/story-list.png
docs/images/writing.png
docs/images/settings.png
```
