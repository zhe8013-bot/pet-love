# Non-3D Product Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished, responsive and fully interactive PetPlanet experience for Home, Pet Profiles, Health Records and Life Logs while hiding the unfinished memory module.

**Architecture:** Keep all product data behind `PetRepository`, add a repository-level upload seam, and build a shared application shell with a pet switcher and query-driven quick actions. Each page owns its loading, error, empty and mutation states while reusable feedback components keep behavior consistent.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Recharts, Phosphor Icons, Express/SQLite API

---

### Task 1: Repository correctness and asset uploads

**Files:**
- Modify: `src/data/repository.ts`
- Modify: `src/data/httpRepository.ts`
- Modify: `src/data/repository.test.ts`
- Modify: `src/data/httpRepository.test.ts`

- [ ] Add failing tests proving local uploads return data URLs, HTTP uploads post multipart files to `/api/assets`, and removing the latest weight recalculates the pet's `currentWeight`.
- [ ] Run `npx vitest run src/data/repository.test.ts src/data/httpRepository.test.ts` and confirm the three new assertions fail for missing behavior.
- [ ] Add this repository contract and implementations:

```ts
type AssetKind = 'avatar' | 'medical' | 'memory'
uploadAssets(files: File[], petId: string, kind: AssetKind): Promise<string[]>
```

Local mode calls `filesToDataUrls(files)`. HTTP mode posts one `FormData` request per file and returns response URLs. `removeWeight` finds the removed entry's pet, deletes it, then assigns the latest remaining weight or `0`.
- [ ] Re-run the targeted tests and confirm they pass.

### Task 2: Application shell and pet profile route

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/App.test.tsx`
- Create: `src/features/pets/PetProfilePage.tsx`
- Modify: `src/features/home/PetForm.tsx`

- [ ] Add failing UI tests that expect four navigation links with no memory link, a `/pets` profile page, global pet switching, query-driven quick actions, avatar upload, edit and confirmed deletion.
- [ ] Run `npx vitest run src/app/App.test.tsx` and confirm navigation/profile assertions fail.
- [ ] Add `/pets`, hide the memory navigation item, and add a shared top bar:

```tsx
<select aria-label="当前宠物" value={currentPetId} onChange={(event) => selectPet(event.target.value)}>
  {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
</select>
```

Quick actions navigate to `/health?new=1`, `/life?new=consumption`, and `/life?new=weight`. Build the profile page from repository summaries and update `PetForm` to create-then-upload-then-patch for new avatars.
- [ ] Re-run the app tests and confirm profile/shell flows pass.

### Task 3: Actionable home dashboard

**Files:**
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] Add failing tests for current-pet summaries, entering the profile from a pet card, completing/postponing today's tasks, and opening non-3D quick actions.
- [ ] Run the home test and verify it fails because the current page uses static summaries and memory actions.
- [ ] Load medical records, consumptions and weights for the current pet. Derive the latest health record, current-month totals and recent records. Persist task dispositions under `petplanet:tasks:<petId>` and remove every visible memory action/preview.
- [ ] Re-run the home tests and confirm they pass.

### Task 4: Complete health-record workflow

**Files:**
- Modify: `src/features/health/HealthPage.tsx`
- Modify: `src/features/health/MedicalRecordForm.tsx`
- Create: `src/components/ConfirmDialog.tsx`
- Create: `src/components/AsyncState.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] Add failing tests for search, status/time filtering, record details, photo display, confirmed deletion, `?new=1`, upload-before-create, loading, retry and no-results states.
- [ ] Run the health tests and confirm the expected controls and states are absent.
- [ ] Implement controlled filters, detail modal, confirmation dialog and request state. The form uploads selected files through `repository.uploadAssets(files, currentPetId, 'medical')` before `addMedicalRecord`, keeps values on failure, and disables save while pending.
- [ ] Re-run health tests and confirm they pass.

### Task 5: Complete monthly care workflow

**Files:**
- Modify: `src/features/life/LifePage.tsx`
- Modify: `src/features/life/ConsumptionForm.tsx`
- Modify: `src/features/life/WeightForm.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] Add failing tests for month navigation, category filtering, empty months, query-driven forms, consumption deletion, weight deletion and current-weight recalculation.
- [ ] Run the life tests and verify the assertions fail against the current page.
- [ ] Derive food, water, grooming and total-cost metrics from the selected month; show a six-month chart and weight history; wire both delete actions through confirmation; support `?new=consumption|weight`; preserve forms on error and disable pending saves.
- [ ] Re-run life tests and confirm they pass.

### Task 6: Stitch visual system, responsive QA and delivery

**Files:**
- Replace: `src/styles/theme.css`
- Modify: `design-qa.md`
- Add: `design-references/stitch-v2/*`

- [ ] Implement the selected Stitch layouts with one token system: desktop fixed sidebar and top bar, mobile bottom navigation, 22px content surfaces, 14px actions, 44px touch targets and no nested-card visual noise.
- [ ] Run `npm test`, `npm run build`, and `git diff --check`; fix all failures.
- [ ] Run the app in local mode and API mode. Use the in-app browser to verify Home, Pets, Health and Life at 1440×1024 and 390×844, including add/delete/filter/error/empty flows.
- [ ] Compare the Stitch references and implementation captures in combined inputs; update `design-qa.md` to `final result: passed` only after all P0/P1/P2 issues are fixed.
- [ ] Commit, push `codex/petplanet-product-v2`, and create or update the delivery PR.
