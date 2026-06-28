import { CalendarDots, Plus, Sparkle, Star } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { usePetData } from '../../data/PetDataProvider'
import type { Memory } from '../../domain/types'
import { MemoryForm } from './MemoryForm'
import { MemoryUniverse } from './MemoryUniverse'
import { seasonForDate, type MemorySceneMode } from './sceneLayout'

const canUseWebGL = () =>
  typeof window !== 'undefined' && typeof window.WebGLRenderingContext !== 'undefined'

export function MemoryPage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const [memories, setMemories] = useState<Memory[]>([])
  const [mode, setMode] = useState<MemorySceneMode>('galaxy')
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
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    setReducedMotion(media.matches)
    const listener = () => setReducedMotion(media.matches)
    media.addEventListener?.('change', listener)
    return () => media.removeEventListener?.('change', listener)
  }, [])

  return (
    <div className={`memory-page memory-mode-${mode}`}>
      <div className="memory-scene" aria-hidden={webgl ? 'true' : undefined}>
        {webgl ? (
          <MemoryUniverse
            memories={memories}
            mode={mode}
            selectedId={selected?.id}
            onSelect={setSelected}
            reducedMotion={reducedMotion}
          />
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

      <header className="memory-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · LANTERN GARDEN</p>
          <h1>记忆星河</h1>
          <p>拖动探索，靠近每一盏属于你们的灯火。</p>
        </div>
        <div className="memory-actions">
          <div className="mode-switch" aria-label="记忆展示模式">
            <button className={mode === 'galaxy' ? 'active' : ''} onClick={() => setMode('galaxy')}>
              <Sparkle size={17} />3D 星河
            </button>
            <button className={mode === 'growth' ? 'active' : ''} onClick={() => setMode('growth')}>
              <CalendarDots size={17} />成长回顾
            </button>
          </div>
          <button className="button memory-add" onClick={() => setFormOpen(true)}><Plus size={18} />添加回忆</button>
        </div>
      </header>

      {mode === 'growth' && (
        <section className="growth-caption">
          <span>四季时间长廊</span>
          <strong>沿着季节，重新走一遍一起长大的路。</strong>
        </section>
      )}

      {selected && (
        <aside className="memory-detail" aria-live="polite">
          <div className="memory-detail-photo"><img src={selected.photos[0]} alt={selected.note} /></div>
          <div>
            <span className="memory-date">{selected.occurredAt} · {seasonForDate(selected.occurredAt)}</span>
            <h2>{selected.note}</h2>
            <p><span>{selected.mood}</span>{selected.isHighlight && <b><Star size={13} weight="fill" />闪光回忆</b>}</p>
          </div>
        </aside>
      )}

      <footer className="season-ribbon">
        {['春', '夏', '秋', '冬'].map((season) => <span key={season}>{season}</span>)}
        <i />
        <strong>{memories.length} 段时光</strong>
      </footer>

      {formOpen && (
        <MemoryForm
          onClose={() => setFormOpen(false)}
          onSaved={(memory) => {
            void loadMemories()
            setSelected(memory)
          }}
        />
      )}
    </div>
  )
}
