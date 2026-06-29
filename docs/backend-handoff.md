# PetPlanet 后端交接说明

这份文档供继续后端工作的 Claude 使用。前端只通过 `src/data/repository.ts` 的 `PetRepository` 读写数据；本地实现和 `src/data/httpRepository.ts` 的 HTTP 实现都已存在，页面组件不应直接调用 `fetch`。仓库中的 Express + SQLite 后端是可运行基线，后续改动应保持接口契约一致。

## 接入目标

- 本地开发：前端 http://localhost:61413，后端建议 http://localhost:61414。
- VITE_DATA_MODE=local 使用当前本地 mock；VITE_DATA_MODE=api 使用 HTTP repository。
- HTTP repository 以 `/api` 为基地址。
- 数据结构以 src/domain/types.ts 为唯一前端事实来源。
- 金额 API 使用人民币元；后端数据库建议保存为分，并在 API 边界转换。
- 日期使用 YYYY-MM-DD，月份使用 YYYY-MM。

## 必须实现的接口

### 宠物

- GET /api/pets → Pet[]
- GET /api/pets/:petId → Pet
- POST /api/pets，请求体 Omit<Pet, id> → Pet
- PATCH /api/pets/:petId，请求体部分宠物字段 → Pet
- DELETE /api/pets/:petId → 204

删除宠物必须级联删除病历、消耗、体重、回忆及关联图片。

### 健康档案

- GET /api/pets/:petId/medical-records → MedicalRecord[]，按 visitDate 降序。
- POST /api/pets/:petId/medical-records，请求体为去掉 id 的病历 → MedicalRecord
- DELETE /api/medical-records/:recordId → 204

### 月度消耗

- GET /api/pets/:petId/consumptions?month=YYYY-MM → ConsumptionEntry[]
- POST /api/pets/:petId/consumptions，请求体为去掉 id 的记录 → ConsumptionEntry
- DELETE /api/consumptions/:entryId → 204
- GET /api/pets/:petId/monthly-summary?month=YYYY-MM → { totalCost, entryCount }

### 体重

- GET /api/pets/:petId/weights → WeightEntry[]，按 measuredAt 升序。
- POST /api/pets/:petId/weights，请求体为去掉 id 的记录 → WeightEntry
- DELETE /api/weights/:entryId → 204

新增体重后，宠物响应中的 currentWeight 应返回最新测量值。

### 回忆（预留，当前前端未启用）

- GET /api/pets/:petId/memories → Memory[]，按 occurredAt 升序。
- POST /api/pets/:petId/memories，请求体为去掉 id 的回忆 → Memory
- PATCH /api/memories/:memoryId，请求体为部分回忆字段 → Memory
- DELETE /api/memories/:memoryId → 204

### 图片

- POST /api/assets 使用 multipart/form-data，字段为 file、petId、kind。
- kind 为 avatar、medical 或 memory。
- 响应为 { id, url, mimeType, sizeBytes }。
- 接受 JPG、PNG、WebP；单文件最大 10MB；使用 UUID 文件名。
- 返回的 url 写入领域对象的 avatar 或 photos 字段。

## 前端 HTTP Repository

`src/data/httpRepository.ts` 已导出 `createHttpPetRepository(baseUrl: string): PetRepository`。

实现规则：

1. 所有非 2xx 响应转换为带中文消息的 Error。
2. 图片由 `repository.uploadAssets()` 先上传，再将返回 URL 写入宠物或病历。
3. 页面组件不得直接调用 fetch。
4. PetDataProvider 只选择 repository，不保存第二套缓存，避免云端与本地记录分叉。

## 数据库建议

使用 SQLite，表名建议：pets、medical_records、consumption_entries、weight_entries、memories、assets、medical_record_assets、memory_assets。

启用外键；写入记录与附件关联时使用事务。首次启动自动迁移，仅空库写入 mock 数据。数据库和上传目录放在 data/，该目录已被忽略。

## 验收清单

- 三只宠物的数据完全隔离。
- 新增病历后列表立即按日期重排。
- 月度切换只返回对应月份的消耗。
- 同月允许多条体重；当前体重取日期最新的一条。
- 预留回忆接口不影响当前四个非 3D 页面。
- 删除宠物不会留下孤儿图片。
- 后端不可用时返回明确错误，前端不得静默回退 localStorage。
