# 明日方舟：终末地网站设计风格文档

## 一、设计概述

明日方舟：终末地网站采用**工业科幻风格**设计，整体视觉呈现**现代、简洁、充满科技感**的特点。设计语言强调**功能性、可读性和视觉层次**，通过鲜明的色彩对比和几何图案营造出独特的品牌识别度。

---

## 二、色彩系统

### 2.1 主色调

#### 品牌黄色（Brand Yellow）

- **主色值**: `#fffa00` / `#fff500`
- **用途**:
  - 主要按钮背景色
  - 强调色和装饰线条
  - 悬停状态高亮
  - 品牌标识色
- **变体色**:
  - `#efe701` - 悬停状态
  - `#eeea00` - 激活状态
  - `#e6de01` - 按下状态

#### 深色系（Dark Colors）

- **主黑色**: `#191919` - 主要文本色、背景色A
- **深灰**: `#1f1f1f` - 模态框头部背景
- **中灰**: `#383838` - 按钮默认背景
- **浅灰**: `#484848` - 按钮悬停背景

#### 浅色系（Light Colors）

- **纯白**: `#fff` / `#ffffff` - 背景色、文本色（深色背景下）
- **浅灰背景**: `#fafafa` - 主要背景色
- **灰色背景**: `#e5e5e5` / `#e6e6e6` - 次要背景、边框
- **浅灰**: `#f2f2f2` - 卡片背景、悬停状态

#### 文本颜色

- **主要文本**: `#191919` - 深色文本
- **次要文本**: `#888` / `#999` / `#b3b3b3` - 辅助信息
- **禁用文本**: `#666` / `#888` - 禁用状态
- **浅色文本**: `#fff` / `#eee` - 深色背景下的文本

### 2.2 语义化颜色

- **分隔线**: `#ccc` / `#d9d9d9` / `#e6e6e6`
- **边框**: `rgba(38, 38, 38, .5)` - 半透明边框
- **阴影**: `rgba(0, 0, 0, .25)` / `rgba(0, 0, 0, .3)` - 柔和阴影
- **遮罩**: `rgba(0, 0, 0, .5)` - 模态框遮罩层

---

## 三、字体系统

### 3.1 字体族

#### Sans 字体族（主要字体）

- **SansRegular**: 常规文本、正文
- **SansMedium**: 中等粗细，用于按钮、标题
- **SansBold**: 粗体，用于大标题、强调

#### Gilroy 字体族（英文标题）

- **Gilroy-Medium**: 中等粗细，用于英文标题
- **Gilroy-Light**: 细体，用于副标题

#### Novecentosanswide 字体族（装饰性标题）

- **Novecentosanswide-Bold**: 粗体，用于大号装饰性标题
- **Novecentosanswide-DemiBold**: 半粗体
- **Novecentosanswide-Medium**: 中等粗细

### 3.2 字体大小系统

#### 标题层级

- **超大标题**: `4.5rem` / `3.75rem` - 页面主标题
- **大标题**: `3rem` - 区块标题
- **中标题**: `2.25rem` / `2.625rem` - 子标题
- **小标题**: `1.875rem` - 卡片标题

#### 正文层级

- **大正文**: `1.75rem` - 按钮文本
- **正文**: `1.5rem` / `1.625rem` - 常规文本
- **小正文**: `1.25rem` / `1.125rem` - 辅助文本
- **极小文本**: `1rem` - 说明文字

### 3.3 行高与字间距

- **行高**: 通常为 `1`（标题）或 `1.5`（正文）
- **字间距**: `letter-spacing: .05em` - 特定标题使用
- **文本转换**: `text-transform: uppercase` - 英文标题常用

---

## 四、设计模式与装饰元素

### 4.1 斜条纹图案（Diagonal Stripe Pattern）

这是网站最具标志性的设计元素，用于装饰背景和组件。

#### 实现方式

```css
background-image: linear-gradient(
  -45deg,
  transparent,
  transparent [percentage]%,
  black 0,
  black [percentage]%,
  transparent 0,
  transparent [percentage]%,
  black 0,
  black [percentage]%,
  transparent 0,
  transparent
);
background-size: 0.5rem 0.5rem;
background-repeat: repeat;
```

#### 应用场景

- 按钮背景（`:before` 伪元素）
- 模态框头部背景
- 装饰性区域
- 悬停状态增强

#### 透明度变化

- **低透明度**: `opacity: .05` - `.2` - 背景装饰
- **中等透明度**: `opacity: .08` - 内容区域装饰
- **高透明度**: `opacity: 1` - 主要装饰元素

### 4.2 边框与分割线

#### 边框样式

- **实心边框**: `border: .375rem solid #e6e6e6` - 分页器
- **细边框**: `border: 1px solid #ccc` / `2px solid rgba(38, 38, 38, .5)`
- **粗边框**: `border-left: .75rem solid #fff500` - 按钮左侧强调

#### 分割线

- **水平分割线**: `height: 1px` / `2px`, `background-color: #ccc` / `#888`
- **垂直分割线**: `width: .25rem` / `.3125rem`, `height: 4.375rem`, `background-color: #fff500`

### 4.3 圆角系统

- **小圆角**: `.25rem` / `2px` - 按钮、卡片
- **中等圆角**: `.5rem` / `4px` - 输入框、标签
- **大圆角**: `2.625rem` / `3.125rem` - 分页器、大型按钮
- **完全圆形**: `border-radius: 50%` - 图标、按钮

### 4.4 阴影系统

#### Drop Shadow

- **轻微阴影**: `filter: drop-shadow(0 0 .25rem rgba(0, 0, 0, .25))`
- **中等阴影**: `box-shadow: 0 0 .75rem rgba(0, 0, 0, .25)`
- **强阴影**: `box-shadow: 0 0 2rem rgba(0, 0, 0, .3)`

#### 内阴影

- 使用 `mask-image` 和渐变创建内阴影效果

---

## 五、组件设计规范

### 5.1 按钮（Button）

#### 主要按钮样式

```css
/* 基础样式 */
width: 20rem;
height: 4.5rem;
background-color: #383838;
color: #eee;
border: none;
border-radius: 2px;
font-size: 1.75rem;
font-family: SansMedium;
filter: drop-shadow(0 0 0.25rem rgba(0, 0, 0, 0.25));

/* 左侧黄色装饰条 */
:after {
  left: 0.5rem;
  width: 1rem;
  height: 55%;
  background-color: #fffa00;
  clip-path: polygon(0 0, 25% 0, 25% 100%, 0 100%);
}

/* 悬停状态 */
:hover {
  background-color: #484848;
  border-radius: 6px;
  :after {
    clip-path: polygon(0 20%, 100% 50%, 0 80%, 0 80%);
    transform: translateX(0.875rem);
  }
}
```

#### 按钮变体

- **浅色按钮**: `background-color: #fff`, `color: #000`
- **禁用按钮**: `background-color: #888`, `color: #666`, `cursor: not-allowed`
- **黄色强调按钮**: `background-color: #fffa00`, `border-left: .75rem solid #fff500`

### 5.2 模态框（Modal）

#### 模态框结构

```css
/* 遮罩层 */
background-color: rgba(0, 0, 0, 0.5);
opacity: 0;
transition: opacity 0.3s ease-in-out;

/* 内容框 */
width: 109rem;
background-color: #fafafa;
font-size: 1rem;

/* 头部 */
height: 8.75rem;
background-color: #1f1f1f;
/* 斜条纹装饰背景 */
background-image: linear-gradient(-45deg, ...);
background-size: 0.5rem 0.5rem;
```

#### 关闭按钮

- 位置: 右上角 `right: 2.125em`
- 颜色: `#fff`
- 悬停: `transform: rotate(90deg)`
- 尺寸: `2.625em` × `auto`

### 5.3 导航栏（Header）

#### PC端导航

- **宽度**: `7.5rem`
- **背景**: `#fff`
- **高度**: `100vh`
- **Logo位置**: 顶部居中
- **导航项**: 垂直排列，每项 `4.5rem` 高
- **激活状态**: 左侧 `border-left: .75rem solid #191919`, 背景 `#e6e6e6`

#### 移动端导航

- **高度**: `9.625rem`
- **阴影**: `box-shadow: 0 0 2rem rgba(0, 0, 0, .3)`
- **Logo**: 缩放显示 `.47` 倍

### 5.4 分页器（Pagination）

```css
height: 5.25rem;
border: 0.375rem solid #e6e6e6;
border-radius: 2.625rem;
background-color: #e6e6e6;
display: flex;
align-items: center;
gap: 3.75rem;

/* 按钮 */
width: 4.625rem;
height: 4.625rem;
border-radius: 50%;
background-color: #fafafa;
box-shadow: 0 0 0.625rem rgba(2, 2, 2, 0.3);

/* 悬停 */
:hover {
  background-color: #fffa00;
}
```

---

## 六、交互与动画

### 6.1 过渡效果

#### 标准过渡时间

- **快速**: `.2s ease` - 颜色、背景变化
- **标准**: `.3s ease` / `.3s ease-in-out` - 位置、尺寸变化
- **慢速**: `.6s cubic-bezier(1, 0, .7, 1)` - 加载动画

#### 常用过渡属性

- `color .2s ease`
- `background-color .2s ease`
- `transform .3s ease`
- `opacity .3s ease-in-out`
- `border-radius .2s ease`

### 6.2 悬停效果

#### 按钮悬停

- 背景色变亮: `#383838` → `#484848`
- 圆角增大: `2px` → `6px`
- 装饰条动画: `clip-path` 变化 + `translateX` 移动

#### 图标悬停

- 颜色变化: `#d9d9d9` → `#858585`
- 旋转效果: `transform: rotate(90deg)`

#### 链接悬停

- 背景高亮: `#e5e5e5` → `#d9d9d9`
- 文本颜色加深

### 6.3 动画效果

#### 闪烁动画（用于加载状态）

```css
@keyframes flashing {
  0% {
    opacity: 0;
  }
  10% {
    opacity: 0.5;
  }
  11% {
    opacity: 0;
  }
  20% {
    opacity: 0.5;
  }
  21% {
    opacity: 0;
  }
  40% {
    opacity: 0.5;
  }
  41% {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

#### 淡入动画

```css
@keyframes fadeIn {
  0% {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
```

---

## 七、响应式设计

### 7.1 断点系统

网站主要使用**方向检测**而非固定宽度断点：

```css
@media (orientation: portrait) {
  /* 竖屏样式 */
}

@media (orientation: landscape) {
  /* 横屏样式 */
}
```

### 7.2 响应式适配策略

#### 字体缩放

- PC端: 标准尺寸
- 移动端: 通常增大 `1.2-1.5倍`

#### 布局变化

- PC端: 横向布局，固定宽度容器
- 移动端: 纵向布局（`flex-direction: column`），全宽容器

#### 间距调整

- PC端: 使用 `rem` 单位，较大间距
- 移动端: 增大间距以适应触摸操作

### 7.3 隐藏/显示规则

- PC端导航在移动端隐藏: `display: none`
- 移动端导航在PC端隐藏: `display: none`
- 装饰元素在移动端简化或隐藏

---

## 八、布局系统

### 8.1 容器宽度

#### 主要内容容器

- **最大宽度**: `160rem` (80rem × 2)
- **居中方式**: `left: calc(50% - 80rem + 3.75rem)`
- **内容区域**: `calc(50% - 80rem + 3.75rem + 9.8125rem)`

#### 移动端容器

- **宽度**: `62.5rem` (31.25rem × 2)
- **居中方式**: `left: calc(50% - 31.25rem)`

### 8.2 间距系统

#### 标准间距

- **小间距**: `.5rem` / `.625rem` / `.75rem`
- **中间距**: `1.25rem` / `1.5rem` / `1.875rem`
- **大间距**: `2.5rem` / `3.25rem` / `3.75rem`
- **超大间距**: `5rem` / `9.8125rem`

#### 内边距

- **按钮内边距**: `padding-left: 8.25rem`, `padding-right: 1rem`
- **卡片内边距**: `.625rem` / `1rem` / `1.25rem`

### 8.3 定位系统

#### 绝对定位

- 大量使用 `position: absolute`
- 使用 `calc()` 进行精确计算
- `transform: translate3d()` 用于居中和对齐

#### 粘性定位

- `position: sticky` - 用于固定导航和标题

---

## 九、特殊效果

### 9.1 遮罩与渐变

#### 渐变遮罩

```css
-webkit-mask-image: linear-gradient(180deg, transparent 0, transparent 50%, black 90%, black);
mask-image: linear-gradient(180deg, ...);
```

#### 背景渐变

- **淡入淡出**: `linear-gradient(180deg, transparent 0, black)`
- **多色渐变**: 用于装饰性背景

### 9.2 滤镜效果

#### 常用滤镜

- **灰度**: `filter: grayscale(1)`
- **亮度**: `filter: brightness(.76)`
- **对比度**: `filter: contrast(200)`
- **反转**: `filter: invert(1)` - 浅色按钮使用

### 9.3 裁剪路径

```css
clip-path: polygon(0 0, 25% 0, 25% 100%, 0 100%);
/* 悬停时变为 */
clip-path: polygon(0 20%, 100% 50%, 0 80%, 0 80%);
```

---

## 十、设计原则总结

### 10.1 核心设计理念

1. **工业科技感**: 通过斜条纹、几何形状、硬朗线条营造工业氛围
2. **品牌识别**: 标志性黄色 `#fffa00` 作为强调色贯穿全站
3. **层次分明**: 通过颜色、大小、间距建立清晰的信息层级
4. **功能优先**: 设计服务于功能，交互清晰直观

### 10.2 视觉特征

- **高对比度**: 深色与浅色、黄色与黑色的强烈对比
- **几何化**: 大量使用矩形、圆形、多边形等几何元素
- **装饰性**: 斜条纹、边框、分割线等装饰元素丰富视觉
- **留白充足**: 合理的间距和留白提升可读性

### 10.3 交互特征

- **平滑过渡**: 所有状态变化都有过渡动画
- **即时反馈**: 悬停、点击状态清晰可见
- **一致性**: 相同功能的组件交互方式统一

---

## 十一、实现建议

### 11.1 CSS变量建议

建议使用CSS变量统一管理颜色和尺寸：

```css
:root {
  /* 主题变量 */
  --theme-bg-primary: #fafafa;
  --theme-bg-secondary: #ffffff;
  --theme-border: #e6e6e6;
  --theme-text-primary: #191919;
  --theme-text-secondary: #888888;
  --theme-accent-color: #fffa00;

  /* 字体 */
  --font-sans-regular: SansRegular;
  --font-sans-medium: SansMedium;
  --font-sans-bold: SansBold;

  /* 间距 */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 3rem;

  /* 圆角 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 2.625rem;
}
```

### 11.2 组件化建议

- 将斜条纹图案封装为可复用组件
- 按钮组件支持多种变体
- 模态框组件统一结构和样式
- 响应式工具类封装

### 11.3 性能优化

- 使用 `transform` 和 `opacity` 进行动画（GPU加速）
- 避免频繁触发重排的属性
- 合理使用 `will-change` 提示浏览器优化

---

## 十二、设计资源

### 12.1 关键颜色值

| 用途     | 颜色值  | RGB                | 使用场景         |
| -------- | ------- | ------------------ | ---------------- |
| 品牌黄   | #fffa00 | rgb(255, 250, 0)   | 按钮、强调、装饰 |
| 主黑色   | #191919 | rgb(25, 25, 25)    | 文本、背景       |
| 深灰     | #1f1f1f | rgb(31, 31, 31)    | 模态框头部       |
| 中灰     | #383838 | rgb(56, 56, 56)    | 按钮默认         |
| 浅灰背景 | #fafafa | rgb(250, 250, 250) | 主要内容背景     |
| 边框灰   | #e6e6e6 | rgb(230, 230, 230) | 边框、分割线     |

### 12.2 字体大小参考

| 类型     | PC端    | 移动端   | 用途       |
| -------- | ------- | -------- | ---------- |
| 超大标题 | 4.5rem  | 3.625rem | 页面主标题 |
| 大标题   | 3rem    | 2.25rem  | 区块标题   |
| 中标题   | 2.25rem | 2.625rem | 卡片标题   |
| 按钮文本 | 1.75rem | 2.625rem | 按钮       |
| 正文     | 1.5rem  | 2.25rem  | 常规文本   |
| 小文本   | 1.25rem | 1.875rem | 辅助信息   |

---

## 十三、游戏数据展示网站布局规范

### 13.1 整体布局结构

终末地一图流网站采用**左右分栏布局**，左侧为固定侧边菜单，右侧为动态内容展示区域。

#### 布局结构

```
┌─────────────────────────────────────────┐
│  Header (主题切换、语言切换)            │
├──────────┬──────────────────────────────┤
│          │                              │
│  Sidebar │    Main Content Area         │
│  (固定)  │    (动态内容)                 │
│          │                              │
│          │                              │
└──────────┴──────────────────────────────┘
```

#### 尺寸规范

- **侧边菜单宽度**: `7.5rem` (PC端) / `100%` (移动端)
- **内容区域宽度**: `calc(100% - 7.5rem)` (PC端) / `100%` (移动端)
- **侧边菜单高度**: `100vh` (PC端) / `auto` (移动端)
- **内容区域高度**: `calc(100vh - Header高度)` (PC端) / `auto` (移动端)

### 13.2 侧边菜单设计（Sidebar）

#### 菜单结构

- **一级菜单**: 2个，垂直排列
- **二级菜单**: 每个一级菜单下包含2个二级菜单项
- **菜单层级**: 支持展开/折叠交互

#### 菜单样式规范

```css
/* 一级菜单项 */
.sidebar-primary-item {
  height: 4.5rem;
  padding: 0 1.5rem;
  background-color: var(--theme-bg-primary);
  border-left: 0.75rem solid transparent;
  transition: all var(--transition-fast);
}

/* 激活状态 */
.sidebar-primary-item.active {
  background-color: var(--theme-border);
  border-left-color: var(--theme-accent-color);
}

/* 二级菜单项 */
.sidebar-secondary-item {
  height: 3.5rem;
  padding-left: 3rem;
  background-color: var(--theme-bg-tertiary);
}

.sidebar-secondary-item.active {
  background-color: var(--theme-border);
  border-left: 0.5rem solid var(--theme-accent-color);
}
```

#### 交互效果

- **悬停状态**: 背景色变化 `#fafafa` → `#e6e6e6`
- **激活状态**: 左侧黄色边框高亮 `0.75rem solid #fffa00`
- **展开/折叠**: 平滑过渡动画 `transition: height 0.3s ease`
- **图标指示**: 使用箭头图标指示展开/折叠状态

### 13.3 内容展示区域设计

#### 内容区域布局

- **内边距**: `2.5rem` / `3.75rem` (PC端) / `1.5rem` (移动端)
- **背景色**: `var(--theme-bg-primary)`（会根据主题在浅色和深色模式之间切换）
- **滚动**: 内容超出时垂直滚动

#### 页面标注规范

- **页面标题**: 显示当前一级菜单和二级菜单名称
- **样式**: 使用大号字体 `2.25rem` / `3rem`，品牌黄色 `#fffa00`
- **位置**: 内容区域顶部居中或左对齐

---

## 十四、主题切换设计规范

### 14.1 主题系统

网站支持**浅色主题（Light）**和**深色主题（Dark）**两种模式。

#### 主题切换按钮

- **位置**: 页面右上角 Header 区域
- **尺寸**: `2.5rem × 2.5rem`
- **样式**: 圆形按钮，图标居中
- **交互**: 点击切换主题，图标平滑旋转

#### 主题实现方式

```css
/* 浅色主题（默认） */
:root {
  --theme-bg-primary: #fafafa;
  --theme-bg-secondary: #ffffff;
  --theme-text-primary: #191919;
  --theme-text-secondary: #888;
  --theme-border: #e6e6e6;
}

/* 深色主题 */
[data-theme='dark'] {
  --theme-bg-primary: #191919;
  --theme-bg-secondary: #1f1f1f;
  --theme-text-primary: #ffffff;
  --theme-text-secondary: #ccc;
  --theme-border: #383838;
}
```

### 14.2 深色主题颜色映射

#### 背景色映射

- **浅色背景** `#fafafa` → **深色背景** `#191919`
- **白色背景** `#ffffff` → **深灰背景** `#1f1f1f`
- **灰色背景** `#e5e5e5` → **中灰背景** `#383838`

#### 文本色映射

- **深色文本** `#191919` → **浅色文本** `#ffffff`
- **次要文本** `#888` → **浅灰文本** `#ccc`
- **浅色文本** `#fff` → **深色文本** `#191919` (保持对比度)

#### 品牌色保持不变

- **品牌黄色** `#fffa00` 在两种主题下保持一致
- **强调色** 使用品牌黄色，确保视觉一致性

### 14.3 主题切换过渡

- **过渡时间**: `0.3s ease-in-out`
- **过渡属性**: `background-color`, `color`, `border-color`
- **平滑切换**: 避免闪烁，使用 CSS 变量实现平滑过渡

---

## 十五、国际化设计规范

### 15.1 多语言支持

网站支持**中文（简体）**和**英文（美国）**两种语言。

#### 语言切换按钮

- **位置**: Header 区域，位于主题切换按钮旁边
- **样式**: 文本按钮或下拉选择器
- **显示**: 当前语言代码（如 `中` / `EN`）或完整语言名称

#### 语言资源结构

```json
{
  "menu": {
    "primary1": "一级菜单1",
    "primary2": "一级菜单2",
    "secondary1_1": "二级菜单1.1",
    "secondary1_2": "二级菜单1.2",
    "secondary2_1": "二级菜单2.1",
    "secondary2_2": "二级菜单2.2"
  },
  "common": {
    "theme": "主题",
    "language": "语言"
  }
}
```

### 15.2 文本适配规则

#### 字体适配

- **中文字体**: 使用系统默认中文字体栈
- **英文字体**: 优先使用 Sans 字体族
- **字体大小**: 根据语言调整，确保可读性

#### 布局适配

- **文本长度**: 考虑不同语言文本长度差异
- **换行处理**: 英文单词不拆分，中文按字符换行
- **间距调整**: 根据文本长度动态调整间距

### 15.3 国际化实现建议

#### 技术实现

- 使用 `@nuxtjs/i18n` 模块实现国际化
- 语言文件存储在 `locales/` 目录
- 支持语言切换持久化（localStorage）

#### 语言切换流程

1. 用户点击语言切换按钮
2. 更新当前语言状态
3. 重新渲染文本内容
4. 保存语言偏好到 localStorage
5. 页面刷新后恢复用户偏好

---

## 十六、响应式布局适配

### 16.1 移动端布局变化

#### 侧边菜单

- **PC端**: 固定左侧，宽度 `7.5rem`，高度 `100vh`
- **移动端**: 可折叠抽屉式菜单，全屏覆盖或底部弹出

#### 内容区域

- **PC端**: 右侧固定宽度，左侧留出菜单空间
- **移动端**: 全宽显示，菜单折叠时占据全部空间

#### Header 区域

- **PC端**: 仅显示主题切换和语言切换
- **移动端**: 增加菜单展开/折叠按钮

### 16.2 触摸交互优化

- **点击区域**: 最小 `44px × 44px` (移动端)
- **手势支持**: 支持滑动展开/折叠菜单
- **反馈效果**: 点击反馈动画，提升用户体验

---

**文档版本**: 2.0  
**最后更新**: 添加游戏数据展示网站布局、主题切换和国际化设计规范  
**适用范围**: 前端开发、UI设计参考
