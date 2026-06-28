# PetPlanet

PetPlanet 是一个面向多宠家庭的温暖生活记录应用，包含宠物角色卡、健康档案、月度消耗与体重趋势，以及可切换成长回顾模式的 3D 照片记忆星河。

## 当前范围

本分支交付完整前端原型：React、TypeScript、Vite、React Three Fiber 与本地 mock 数据仓库。后端不在本分支实现，接口契约与接入边界见 [Claude 后端交接说明](docs/backend-handoff.md)。

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
