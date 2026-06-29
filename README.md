# PetPlanet

PetPlanet 是一个面向多宠家庭的温暖生活记录应用，当前包含首页照护面板、宠物档案、健康病历、月度消耗与体重趋势。

## 当前范围

本分支专注可用的非 3D 前端：React、TypeScript、Vite、真实表单与本地 mock 数据仓库。记忆/3D 模块不在当前导航和构建入口中，待后续方向确认后再接入。仓库中已有 Express + SQLite 基础后端，后续后端工作边界见 [Claude 后端交接说明](docs/backend-handoff.md)。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:61413/`。当前数据保存在浏览器 localStorage，可通过 `.env.example` 了解后续 API 模式的环境变量约定。

## 验证

```bash
npm test
npm run build
```

视觉验证记录见 [design-qa.md](design-qa.md)。
