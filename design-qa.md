# PetPlanet 设计 QA

## 对照范围

- 首页视觉源：`design-references/stitch/home.png`
- 记忆星河氛围源：`design-references/stitch/memory-shader.png`
- 桌面实现：`qa-home-desktop.png`、`qa-memory-desktop-final.png`
- 移动实现：`qa-home-mobile-final.png`、`qa-memory-mobile-final.png`
- 合并对照：`qa-home-comparison.png`、`qa-memory-comparison.png`

桌面视口为 1440×1024，移动视口为 390×844。页面使用相同的 mock 宠物与记忆数据，浏览器 localStorage 状态保持一致。

## 校准结果

- 首页复现了 Stitch 的暖米色画布、珊瑚色操作按钮、宠物角色卡、健康提醒与近期动态层级。
- 记忆星河使用真实 WebGL shader、照片纹理平面、萤火粒子、景深层次、拖拽探索与鼠标视差；暮色从深梅紫过渡到暖桃色，匹配 Stitch 氛围参考。
- 记忆页标题与 3D 舞台之间保留安全区，桌面和移动端均未出现标题被照片遮挡的问题。
- 移动端切换为底部导航并降低粒子数量；控制按钮、照片详情卡和主要表单均落在可操作宽度内。
- `prefers-reduced-motion` 或无 WebGL 时自动使用静态 2D 成长画廊。

## 已修复问题

- P1：3D 照片覆盖页面标题；整体舞台下移并为标题增加深色文字阴影。
- P1：移动端模式切换挤压；控制区改为三列紧凑布局并保持单行标签。
- P2：桌面记忆页空间感不足；加入全屏暮色 shader 与分层光照。
- P2：首页窄屏横向溢出；宠物卡和统计区改为单列，自适应隐藏桌面侧栏。

## 结论

P0、P1、P2 视觉与交互问题均已解决。Stitch 首页源图为更高分辨率长页，本实现按产品首版收敛为响应式应用信息架构，因此内容密度存在有意差异；颜色、层级、圆角、间距与核心氛围已对齐。
