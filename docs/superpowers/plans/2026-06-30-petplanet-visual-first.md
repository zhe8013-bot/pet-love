# PetPlanet 视觉优先实施计划

> **面向执行代理：** 必须使用 superpowers:executing-plans，逐项实施本计划。步骤使用复选框（- [ ]）跟踪。

**目标：** 在不删除现有功能的前提下，先把 PetPlanet 的全局框架和首页升级为移动优先的高级宠物陪伴 App。

**架构：** 保留 React/Vite、PetRepository、现有表单与业务页面。以现有数据拼装新的首页读模型；App Shell 改为五项导航，首页只突出当前宠物。视觉以 B 的空间构图为骨架、A 的奶油质感为底、C 的照片叙事作为回忆入口。

**技术栈：** React 19、TypeScript 6、React Router 7、Vitest、Testing Library、Phosphor Icons、CSS。

---

## 任务 1：用测试锁定移动 App 行为

**文件：**

- 修改：src/app/App.test.tsx

- [ ] **步骤 1：把四项导航测试改为五项导航**

测试必须断言主导航包含：首页、健康、生活、回忆、宠物，并能进入对应路由。

- [ ] **步骤 2：把多宠物首页测试改为当前宠物首页**

测试必须断言：首页主区域只出现当前宠物；顶部宠物选择器切换后，主视觉同步更新；不再渲染“选择米粒”“选择糖糖”等平均宠物卡按钮。

- [ ] **步骤 3：新增首页结构测试**

断言以下区域存在：

    current-pet-hero
    today-care
    monthly-bento
    memory-preview

- [ ] **步骤 4：运行测试并确认失败**

运行：

    npm test -- src/app/App.test.tsx

预期：因现有四项导航、多宠物卡与旧首页结构而 FAIL。

## 任务 2：实现五项移动 App Shell

**文件：**

- 修改：src/app/App.tsx
- 修改：src/app/AppShell.tsx
- 修改：src/styles/theme.css

- [ ] **步骤 1：恢复回忆路由**

在 App.tsx 中懒加载 MemoryPage，并添加 /memories 子路由。

- [ ] **步骤 2：统一导航来源**

AppShell 使用同一 navItems 数组生成移动底栏与宽屏侧栏：

    首页 /
    健康 /health
    生活 /life
    回忆 /memories
    宠物 /pets

- [ ] **步骤 3：保留全局宠物切换与快速记录**

顶部使用当前宠物头像与 select；“记录一下”继续打开现有病历、消费、体重入口，并增加回忆入口。所有可见按钮必须有真实行为。

- [ ] **步骤 4：实现移动优先框架样式**

390px 下使用顶部栏、五项底部导航和安全区；900px 以上转为轻量侧栏。不得出现水平滚动。

- [ ] **步骤 5：运行 App 测试**

运行：

    npm test -- src/app/App.test.tsx

预期：导航相关测试 PASS，首页结构测试仍 FAIL。

## 任务 3：实现当前宠物首页与视觉层级

**文件：**

- 修改：src/features/home/HomePage.tsx
- 修改：src/styles/theme.css
- 修改：src/app/App.test.tsx

- [ ] **步骤 1：重组首页**

首页按以下顺序渲染：

1. current-pet-hero：唯一当前宠物照片、名字、年龄、状态与今日进度；
2. today-care：共享时间线，保留完成和稍后行为；
3. monthly-bento：体重主块，消费、健康、照片三个次块；
4. memory-preview：真实照片叠层，进入 /memories。

- [ ] **步骤 2：保留现有数据与操作**

继续从 repository 读取体重、病历、消费和回忆；继续使用 currentPetId；保留病历、消费和体重快速记录入口。宠物新增移到 /pets，不在首页展示多宠卡。

- [ ] **步骤 3：实现视觉系统**

使用奶油白背景、深梅紫文字、蜜桃珊瑚主色、鼠尾草辅助色。宠物主视觉采用同心轨道、真实照片、轻微遮挡和环境阴影；Bento 不做后台表格；回忆入口采用真实照片和深色电影感表面。

- [ ] **步骤 4：保持可访问性**

保留可见焦点、按钮名称、44px 触控目标和 prefers-reduced-motion。轨道仅为装饰，不得影响阅读顺序。

- [ ] **步骤 5：运行 App 测试**

运行：

    npm test -- src/app/App.test.tsx

预期：首页、导航和既有业务流程测试 PASS。

## 任务 4：视觉 QA 与交付

**文件：**

- 修改：design-qa.md
- 新增：design-qa/home-mobile-app.png
- 新增：design-qa/home-mobile-comparison.png

- [ ] **步骤 1：运行完整验证**

运行：

    npm test
    npm run build

预期：全部测试通过，构建状态码为 0。

- [ ] **步骤 2：启动本地应用**

运行：

    npm run dev

- [ ] **步骤 3：在 390×844 捕获首页**

使用首个可用浏览器捕获 /，并与 previews/petplanet-stitch/B-soft-orbit.png 组成同尺寸对比图；A 与 C 作为色彩和照片叙事辅助参考。

- [ ] **步骤 4：写 design-qa.md**

必须检查字体、间距、颜色、图片、文案、底部安全区和交互。修复所有 P0/P1/P2 后，将 final result 写为 passed。

- [ ] **步骤 5：再次运行验证并提交**

运行：

    npm test
    npm run build
    git diff --check

全部通过后提交 App Shell、首页、测试和 QA 证据。

