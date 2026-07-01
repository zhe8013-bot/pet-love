import { CalendarDots, Camera, Plus, Sparkle, Star } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePetData } from '../../data/PetDataProvider'
import type { Memory } from '../../domain/types'
import { MemoryForm } from './MemoryForm'
import { seasonForDate } from './sceneLayout'

const dayInMilliseconds = 86400000

export function MemoryPage() {
  const { currentPet, currentPetId, repository } = usePetData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [memories, setMemories] = useState<Memory[]>([])
  const [selected, setSelected] = useState<Memory>()
  const [formOpen, setFormOpen] = useState(false)

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

  const closeForm = () => {
    setFormOpen(false)
    if (searchParams.has('new')) setSearchParams({})
  }

  const highlights = memories.filter((memory) => memory.isHighlight)
  const latestHighlight = highlights.at(-1)
  const photoCount = memories.reduce((sum, memory) => sum + memory.photos.length, 0)
  const firstMemoryDate = memories.map((memory) => memory.occurredAt).sort()[0]
  const growthDays = firstMemoryDate
    ? Math.max(1, Math.floor((Date.now() - new Date(`${firstMemoryDate}T00:00:00`).getTime()) / dayInMilliseconds) + 1)
    : 0
  const chapters = useMemo(() => {
    const groups = new Map<string, number>()
    memories.slice().reverse().forEach((memory) => {
      const label = `${memory.occurredAt.slice(0, 4)} · ${seasonForDate(memory.occurredAt)}季`
      groups.set(label, (groups.get(label) ?? 0) + 1)
    })
    return Array.from(groups, ([label, count]) => ({ label, count }))
  }, [memories])
  const futurePhotos = memories.slice().reverse().flatMap((memory) => memory.photos).slice(0, 3)

  return (
    <div className="memory-page memory-mode-growth">
      <header className="memory-header">
        <div>
          <p className="eyebrow">{currentPet?.name ?? '宠物'} · LIFE ALBUM</p>
          <h1>生活回忆</h1>
          <p>把那些普通又珍贵的日子，收进一册会继续生长的相册。</p>
        </div>
        <div className="memory-actions">
          <button className="button memory-add" onClick={() => setFormOpen(true)}><Plus size={18} />添加回忆</button>
        </div>
      </header>

      <div className="memory-page-content">
        <section className="memory-overview" aria-label="成长概览">
          <article><span><Camera size={19} />生活照片</span><strong>{photoCount}<small> 张</small></strong></article>
          <article><span><CalendarDots size={19} />陪伴时光</span><strong>{growthDays}<small> 天</small></strong></article>
          <article><span><Star size={19} />闪光回忆</span><strong>{highlights.length}<small> 段</small></strong></article>
        </section>

        <section className="memory-highlight" aria-label="闪光回忆">
          <div className="memory-highlight-copy">
            <span><Star size={15} weight="fill" />闪光回忆</span>
            <h2>{latestHighlight?.note ?? '下一段闪光时刻，等你们一起写下。'}</h2>
            <p>{latestHighlight ? `${latestHighlight.occurredAt} · ${latestHighlight.mood}` : '可以在添加回忆时，把特别的一天标记为闪光回忆。'}</p>
          </div>
          {(latestHighlight?.photos[0] ?? currentPet?.avatar) && (
            <img src={latestHighlight?.photos[0] ?? currentPet?.avatar} alt="" />
          )}
        </section>

        <section className="memory-chapters" aria-label="季节时间线">
          <div className="album-heading">
            <div>
              <span>SEASONAL CHAPTERS</span>
              <h2>沿着季节，翻回共同生活</h2>
            </div>
            <strong>{chapters.length} 个章节</strong>
          </div>
          <div className="memory-chapter-list">
            {chapters.map((chapter) => (
              <article key={chapter.label}><CalendarDots size={18} /><strong>{chapter.label}</strong><span>{chapter.count} 段时光</span></article>
            ))}
          </div>
        </section>

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

        <section className="future-memory-entry" aria-label="未来 3D 记忆星河">
          <div>
            <span><Sparkle size={16} weight="fill" />未来入口 · 2.5D 预览</span>
            <h2>未来 3D 记忆星河</h2>
            <p>今后每张生活照片都可以成为一盏回忆灯。当前阶段只保留入口与视觉预告，不加载真实 3D 场景。</p>
            <strong>COMING LATER</strong>
          </div>
          <div className="future-memory-photos" aria-hidden="true">
            {futurePhotos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt="" />)}
          </div>
        </section>
      </div>

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
