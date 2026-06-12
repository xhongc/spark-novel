import type { Story, Section, ChatMessage, Material } from '@/types'

const mockSetting = `## 主要人物

### 林远（主角）
35岁，前米其林厨师，因一场意外失去了味觉。沉默寡言，内心细腻，对烹饪有着近乎执念的热爱。
- **动机**：重新找回味觉，证明自己仍然是一位好厨师

### 苏晚（配角）
28岁，美食博主，性格开朗，偶然来到小镇，被林远的厨艺吸引。
- **动机**：寻找真正打动人心的美食故事

### 老周（配角）
60岁，小镇老街坊，「夜半」的常客，知道很多小镇的秘密。
- **动机**：守护小镇的宁静与温情

## 主要场景

### 「夜半」深夜食堂
位于小镇老街尽头的一家小食堂，只在深夜营业。昏黄的灯光，木质桌椅，墙上挂着褪色的菜单。
- **氛围**：温暖、静谧、治愈

### 林远的厨房
食堂后厨，整洁有序，每一件厨具都有固定的位置。窗外能看到小镇的夜景。
- **氛围**：专注、秩序、孤独

## 时代背景
现代，南方沿海小镇

## 整体基调
温暖治愈，带有淡淡的忧伤

## 主题
- 失去与重获
- 味觉与记忆
- 孤独与陪伴

## 核心冲突
林远在失去味觉后，如何仅凭经验和直觉继续烹饪，以及他是否愿意接受帮助打开心扉`

export const mockStories: Story[] = [
  {
    id: '深夜食堂',
    title: '深夜食堂',
    premise: '一个失去味觉的厨师在小镇开了一家深夜食堂，用料理治愈每一位深夜来客。',
    stage: 'writing',
    setting: mockSetting,
    outline: `### 第1章：雨夜来客\n雨夜，第一位客人推开了「夜半」的门。\n\n### 第2章：隐藏的味觉\n苏晚第一次来到食堂，察觉到林远的异样。`,
    genre: '治愈',
    targetWordCount: 12000,
    currentWordCount: 4800,
    sectionCount: 8,
    createdAt: '2026-06-10T10:00:00Z',
    updatedAt: '2026-06-12T08:30:00Z',
  },
  {
    id: '雨巷',
    title: '雨巷',
    premise: '一个在老城区开书店的女孩，每天在雨巷中遇到一个神秘的读者。',
    stage: 'completed',
    setting: null,
    outline: null,
    genre: '悬疑',
    targetWordCount: 8000,
    currentWordCount: 8200,
    sectionCount: 6,
    createdAt: '2026-06-05T14:00:00Z',
    updatedAt: '2026-06-09T16:00:00Z',
  },
  {
    id: '星际迷途',
    title: '星际迷途',
    premise: '一名宇航员在执行深空任务时意外穿越到了平行宇宙...',
    stage: 'setting',
    setting: null,
    outline: null,
    genre: '科幻',
    targetWordCount: 10000,
    currentWordCount: 0,
    sectionCount: 0,
    createdAt: '2026-06-12T09:00:00Z',
    updatedAt: '2026-06-12T09:00:00Z',
  },
]

export const mockSections: Section[] = [
  {
    id: '01-雨夜来客.md',
    storyId: '深夜食堂',
    title: '雨夜来客',
    summary: '雨夜，第一位客人推开了「夜半」的门。林远端出一碗热气腾腾的阳春面，唤起了客人尘封多年的记忆。',
    content: `雨丝斜斜地打在青石板路上，溅起细碎的水花。\n\n小镇老街尽头，一盏昏黄的灯透过蒙蒙雨幕，像是深海里的一点微光。门楣上挂着一块褪色的木牌，「夜半」两个字被雨水洗得发亮。\n\n林远站在灶台前，手指轻轻拂过一排调料瓶。他闭上眼睛，深吸一口气——葱花的辛辣、酱油的醇厚、猪油的温润。虽然尝不出味道，但这些气味早已刻进了他的肌肉记忆里。\n\n门被推开，一阵湿冷的风涌了进来。\n\n"老板，还有吃的吗？"\n\n来人是个中年男人，西装被雨水打湿，头发贴在额头上，看起来狼狈不堪。他在靠门的位置坐下，搓了搓手。\n\n林远点了点头，转身走进厨房。\n\n阳春面，最简单的面，也最考验功夫。水要宽，火要旺，面要在沸腾的水中翻滚恰好四十五秒。多一秒则软，少一秒则硬。\n\n他凭直觉捞起面条，盛入早已备好的清汤中，撒上葱花，淋一勺猪油。\n\n"请慢用。"\n\n中年男人挑起一筷面条送入口中，忽然愣住了。他放下筷子，低下头，肩膀微微颤抖。\n\n"这味道……和我母亲做的一模一样。"\n\n林远没有说话，只是默默地又添了一碗汤。\n\n雨还在下，夜还很长。`,
    wordCount: 1523,
    targetWordCount: 1500,
    sortOrder: 1,
    status: 'completed',
    createdAt: '2026-06-10T11:00:00Z',
    updatedAt: '2026-06-10T12:00:00Z',
  },
  {
    id: '02-隐藏的味觉.md',
    storyId: '深夜食堂',
    title: '隐藏的味觉',
    summary: '苏晚第一次来到「夜半」，她敏锐地察觉到林远的异样。一道糖醋排骨引发了两人之间的对话。',
    content: `苏晚是在一个偶然的夜晚发现这家食堂的。\n\n她举着相机在老街取景，被一阵若有若无的香气吸引。循着味道走到街尾，看到了那块写着「夜半」的木牌。\n\n"这也太隐蔽了吧。"她推开门，一股暖意扑面而来。\n\n食堂不大，七八张桌子，此刻只坐了两个人。墙上的菜单用粉笔写着，字迹工整得像是印刷出来的。\n\n"老板，你这里有什么推荐？"\n\n林远抬起眼，看了她一眼："糖醋排骨。"\n\n"那就来一份。"\n\n十分钟后，一盘色泽红亮的糖醋排骨端了上来。苏晚夹起一块咬了一口，眼睛顿时亮了。\n\n"好吃！酸甜比例刚好，排骨炸得外酥里嫩……你这手艺，怎么窝在这种小地方？"\n\n林远擦着杯子，没有接话。\n\n苏晚是做美食博主的，她太清楚什么样的菜是真正的好菜。这盘糖醋排骨，没有任何炫技的成分，就是扎扎实实的基本功。\n\n但她也注意到了一个细节——林远在做完菜后，没有像其他厨师那样试味道。\n\n"你不尝一下吗？"\n\n林远的手顿了一下。\n\n"不用。"\n\n苏晚没有追问，但她把这个疑问记在了心里。`,
    wordCount: 1802,
    targetWordCount: 1800,
    sortOrder: 2,
    status: 'completed',
    createdAt: '2026-06-10T13:00:00Z',
    updatedAt: '2026-06-10T14:00:00Z',
  },
  {
    id: '03-厨房里的秘密.md',
    storyId: '深夜食堂',
    title: '厨房里的秘密',
    summary: '苏晚开始频繁光顾「夜半」，她逐渐发现了林远失去味觉的秘密。老周道出了林远的过去。',
    content: `此后每个夜晚，苏晚都会准时出现在「夜半」。\n\n她开始有意无意地观察林远做菜。他的每一个动作都精准得像是编好了程序——盐放多少，从来不用量勺，全靠手指捏；火候的控制，全看锅里烟气的颜色。\n\n"你做菜从来不尝味道。"有一天苏晚终于忍不住了，"为什么？"\n\n林远沉默了很久。\n\n"因为我尝不出来。"\n\n苏晚愣住了。\n\n"两年前的一场车祸，"林远的声音很平静，像是在说别人的事，"味觉完全丧失了。"\n\n"那你为什么还……"\n\n"还做菜？"林远微微勾了一下嘴角，"因为除了做菜，我什么都不会。"\n\n苏晚不知道该说什么。她看着林远转身走进厨房的背影，忽然觉得那扇门后面藏着整个世界的重量。\n\n老周是那天最后走的客人。他经过苏晚身边时，轻声说了一句：\n\n"丫头，你知道吗，他以前是米其林三星的主厨。出事以后，就再也没回过那个圈子。"\n\n苏晚望着厨房里那个忙碌的身影，心里涌起一种说不清的感觉。`,
    wordCount: 1650,
    targetWordCount: 1600,
    sortOrder: 3,
    status: 'review',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-11T11:00:00Z',
  },
  {
    id: '04-意外的坦白.md',
    storyId: '深夜食堂',
    title: '意外的坦白',
    summary: '苏晚提出帮助林远重新训练味觉，两人开始了艰难的尝试。',
    content: undefined,
    wordCount: 0,
    targetWordCount: 1500,
    sortOrder: 4,
    status: 'locked',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-11T10:00:00Z',
  },
  {
    id: '05-深夜的对峙.md',
    storyId: '深夜食堂',
    title: '深夜的对峙',
    summary: '林远面对来自老东家的邀请，陷入两难。苏晚的鼓励让他开始正视自己的内心。',
    content: undefined,
    wordCount: 0,
    targetWordCount: 1500,
    sortOrder: 5,
    status: 'locked',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-11T10:00:00Z',
  },
  {
    id: '06-真相大白.md',
    storyId: '深夜食堂',
    title: '真相大白',
    summary: '味觉恢复的契机出现在一个意想不到的时刻，而林远终于理解了味觉的真正含义。',
    content: undefined,
    wordCount: 0,
    targetWordCount: 1500,
    sortOrder: 6,
    status: 'locked',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-11T10:00:00Z',
  },
  {
    id: '07-最后一餐.md',
    storyId: '深夜食堂',
    title: '最后一餐',
    summary: '林远为苏晚做了一顿特别的晚餐，两人之间的关系迎来了转折。',
    content: undefined,
    wordCount: 0,
    targetWordCount: 1500,
    sortOrder: 7,
    status: 'locked',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-11T10:00:00Z',
  },
  {
    id: '08-味觉的回归.md',
    storyId: '深夜食堂',
    title: '味觉的回归',
    summary: '故事尾声，林远重新找到了烹饪的意义，「夜半」迎来了新的开始。',
    content: undefined,
    wordCount: 0,
    targetWordCount: 1500,
    sortOrder: 8,
    status: 'locked',
    createdAt: '2026-06-11T10:00:00Z',
    updatedAt: '2026-06-11T10:00:00Z',
  },
]

export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: '本节已完成，我发现了 2 个可以优化的地方：\n1. 第三段的对话可以更简洁有力\n2. 结尾的意象可以更丰富一些',
    createdAt: '2026-06-11T12:00:00Z',
    type: 'text',
  },
  {
    id: 'msg-2',
    role: 'user',
    content: '把结尾改得更有余韵',
    createdAt: '2026-06-11T12:01:00Z',
    type: 'text',
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content: '我来修改结尾部分：',
    createdAt: '2026-06-11T12:01:30Z',
    type: 'diff',
    diffData: {
      original: '雨还在下，夜还很长。',
      modified: '雨还在下，夜还很长。\n灶台上的火苗轻轻跳动，像是在低声哼唱一首古老的歌谣。',
    },
  },
]

export const mockMaterials: Material[] = [
  { id: 'folder-1', name: '人物小传', type: 'folder', parentId: null, createdAt: '2025-03-01T10:00:00Z', updatedAt: '2025-03-10T14:00:00Z' },
  { id: 'folder-2', name: '场景描写', type: 'folder', parentId: null, createdAt: '2025-03-02T10:00:00Z', updatedAt: '2025-03-09T16:00:00Z' },
  { id: 'folder-3', name: '灵感碎片', type: 'folder', parentId: null, createdAt: '2025-03-05T10:00:00Z', updatedAt: '2025-03-11T09:00:00Z' },
  { id: 'file-1', name: '林远的人物设定', type: 'file', parentId: 'folder-1', content: '林远，35岁，前米其林厨师。\n\n三年前的一场意外让他失去了味觉。他没有告诉任何人，只是默默离开了高档餐厅，来到这座海边小镇，开了一家只在深夜营业的小食堂。\n\n他相信，即使尝不到味道，烹饪的本能依然存在于他的手指、他的记忆、他对食材的理解之中。', createdAt: '2025-03-01T10:30:00Z', updatedAt: '2025-03-08T15:00:00Z' },
  { id: 'file-2', name: '苏晚的人物设定', type: 'file', parentId: 'folder-1', content: '苏晚，28岁，美食博主。\n\n她走遍大江南北，寻找那些被遗忘的味道。她相信每一道菜背后都有一个故事，而她想把这些故事记录下来。', createdAt: '2025-03-02T11:00:00Z', updatedAt: '2025-03-09T14:00:00Z' },
  { id: 'file-3', name: '深夜食堂描写', type: 'file', parentId: 'folder-2', content: '「夜半」坐落在老街尽头，一扇半掩的木门后透出昏黄的灯光。\n\n店内只有六张桌子，桌面被岁月打磨得发亮。墙上挂着一块褪色的黑板菜单，用粉笔写着当日的菜式。厨房是开放式的，灶台上的铜锅在火光中闪烁。', createdAt: '2025-03-03T09:00:00Z', updatedAt: '2025-03-10T16:00:00Z' },
  { id: 'file-4', name: '雨夜场景', type: 'file', parentId: 'folder-2', content: '雨丝细密如针，落在青石板路上发出轻柔的声响。路灯在雨雾中晕开一圈暖黄色的光，像是小镇在深夜里为归人留的一盏灯。', createdAt: '2025-03-04T14:00:00Z', updatedAt: '2025-03-09T11:00:00Z' },
  { id: 'file-5', name: '关于味觉的随想', type: 'file', parentId: 'folder-3', content: '味觉不只是舌头的事。\n\n记忆中的味道，比此刻嘴里的味道更真实。小时候外婆做的红烧肉，我早已记不清确切的味道，但那种温暖的感觉从未消退。\n\n也许林远失去味觉，反而让他触碰到了烹饪的本质——不是调味的精确，而是心意的传递。', createdAt: '2025-03-06T20:00:00Z', updatedAt: '2025-03-11T09:30:00Z' },
  { id: 'file-6', name: '未分类笔记', type: 'file', parentId: null, content: '几个可以用在故事里的意象：\n- 老式收音机里传来的深夜电台\n- 窗台上枯萎又被雨水救活的盆栽\n- 一只总在深夜出现的流浪猫', createdAt: '2025-03-07T22:00:00Z', updatedAt: '2025-03-11T08:00:00Z' },
]
