import { CalendarDots, Plus, Sparkle, Star } from '@phosphor-icons/react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePetData } from '../../data/PetDataProvider'
import type { Memory } from '../../domain/types'
import { MemoryForm } from './MemoryForm'
import { seasonForDate, type MemorySceneMode } from './sceneLayout'

const MemoryUniverse = lazy(() => import('./MemoryUniverse').then((module) => ({
  default: module.MemoryUniverse,
})))

const canUseWebGL = () =>
  typeof window !== 'undefined' && typeof window.WebGLRenderingContext !== 'undefined'

export function MemoryPage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [memories, setMemories] = useState<Memory[]>([])
  const [mode, setMode] = useState<MemorySceneMode>('growth')
  const [selected, setSelected] = useState<Memory>()
  const [formOpen, setFormOpen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const webgl = useMemo(canUseWebGL, [])

  const loadMemories = async () => {
    if (!currentPetId) return
    const next = await repository.listMemories(currentPetId)
    setMemories(next)
    setSelected((current) => next.find((memory) => memory.id === current?.id) ?? next.at(-1))
  }

  useEffect(() => {
    void loadMemories()
  }, [currentPetId, repository])

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true)
  }, [searchParams])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    setReducedMotion(media.matches)
    const listener = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', listener)
    return () => media.removeEventListener?.('change', listener)
  }, [])

  const closeForm = () => {
    setFormOpen(false)
    if (searchParams.has('new')) setSearchParams({})
  }

  const isAlbum = mode === 'growth'

  return (
    <div className={`memory-page memory-mode-${mode}`}>
      {!isAlbum && (
        <div className="memory-scene" aria-hidden={webgl ? 'true' : undefined}>
          {webgl ? (
            <Suspense fallback={<div className="memory-scene-loading">正在点亮回忆星河…</div>}>
              <MemoryUniverse
                memories={memories}
                mode="galaxy"
                selectedId={selected?.id}
                onSelect={setSelected}
                reducedMotion={reducedMotion}
              />
            </Suspense>
          ) : (
            <section className="memory-fallback" aria-label="2D 回忆画廊">
              {memories.map((memory) => (
                <button
                  key={memory.id}
                  aria-label={`查看回忆：${memory.note}`}
                  onClick={() => setSelected(memory)}
                >
                  <img src={memory.photos[0]} alt="" />
                </button>
              ))}
            </section>
          )}
        </div>
      )}

      <header className="memory-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · {isAlbum ? 'LIFE ALBUM' : 'LANTERN GARDEN'}</p>
          <h1>{isAlbum ? '生活回忆' : '记忆星河'}</h1>
          <p>{isAlbum ? '把那些普通又珍贵的日子，收进一册会继续生长的相册。' : '拖动探索，靠近每一盏属于你们的灯火。'}</p>
        </div>
        <div className="memory-actions">
          <div className="mode-switch" aria-label="记忆展示模式">
            <button
              aria-pressed={isAlbum}
              className={isAlbum ? 'active' : ''}
              onClick={() => setMode('growth')}
            >
              <CalendarDots size={17} />2D 相册
            </button>
            <button
              aria-pressed={!isAlbum}
              className={!isAlbum ? 'active' : ''}
              onClick={() => setMode('galaxy')}
            >
              <Sparkle size={17} />3D 星河
            </button>
          </div>
          <button className="button memory-add" onClick={() => setFormOpen(true)}><Plus size={18} />添加回忆</button>
        </div>
      </header>

      {isAlbum && (
        <section className="memory-album" aria-label="2D 回忆画廊">
          <div className="album-heading">
            <div>
              <span>GROWING TOGETHER</span>
              <h2>一起长大的日子</h2>
            </div>
            <strong>{memories.length} 段时光</strong>
          </div>
          <div className="album-grid">
            {memories.slice().reverse().map((memory) => (
              <button
                key={memory.id}
                className={`album-card ${selected?.id === memory.id ? 'active' : ''}`}
                aria-label={`查看回忆：${memory.note}`}
                aria-pressed={selected?.id === memory.id}
                onClick={() => setSelected(memory)}
              >
                <img src={memory.photos[0]} alt="" />
                <span>{memory.occurredAt} · {seasonForDate(memory.occurredAt)}</span>
                <strong>{memory.note}</strong>
                <small>{memory.mood}{memory.isHighlight ? ' · 闪光回忆' : ''}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {!isAlbum && selected && (
        <aside className="memory-detail" aria-live="polite">
          <div className="memory-detail-photo"><img src={selected.photos[0]} alt={selected.note} /></div>
          <div>
            <span className="memory-date">{selected.occurredAt} · {seasonForDate(selected.occurredAt)}</span>
            <h2>{selected.note}</h2>
            <p><span>{selected.mood}</span>{selected.isHighlight && <b><Star size={13} weight="fill" />闪光回忆</b>}</p>
          </div>
        </aside>
      )}

      {!isAlbum && (
        <footer className="season-ribbon">
          {['春', '夏', '秋', '冬'].map((season) => <span key={season}>{season}</span>)}
          <i />
          <strong>{memories.length} 段时光</strong>
        </footer>
      )}

      {formOpen && (
        <MemoryForm
          onClose={closeForm}
          onSaved={(memory) => {
            void loadMemories()
            setSelected(memory)
          }}
        />
      )}
    </div>
  )
}
