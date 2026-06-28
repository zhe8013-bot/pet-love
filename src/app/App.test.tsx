import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

describe('PetPlanet app', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('shows all pet role cards and switches the active pet', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: '今天也一起好好生活' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择豆包' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择米粒' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择糖糖' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /选择米粒/ }))
    expect(screen.getByText('米粒的本月概览')).toBeInTheDocument()
  })

  it('navigates to health and life records from the primary navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '健康档案' }))
    expect(await screen.findByRole('heading', { name: '健康档案' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增病历' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '生活记录' }))
    expect(await screen.findByRole('heading', { name: '生活记录' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '记录体重' })).toBeInTheDocument()
  })

  it('adds a medical record from the health page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '健康档案' }))
    await user.click(await screen.findByRole('button', { name: '新增病历' }))

    const dialog = screen.getByRole('dialog', { name: '新增病历' })
    await user.type(within(dialog).getByLabelText('就诊日期'), '2026-06-28')
    await user.type(within(dialog).getByLabelText('症状'), '散步后轻微跛行')
    await user.type(within(dialog).getByLabelText('诊断'), '脚垫轻微擦伤')
    await user.type(within(dialog).getByLabelText('治疗方案'), '清洁后减少运动两天')
    await user.click(within(dialog).getByRole('button', { name: '保存病历' }))

    expect(await screen.findByText('脚垫轻微擦伤')).toBeInTheDocument()
    expect(screen.getByText('治疗中')).toBeInTheDocument()
  })

  it('adds monthly consumption from the life page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '生活记录' }))
    await user.click(await screen.findByRole('button', { name: '记录消耗' }))

    const dialog = screen.getByRole('dialog', { name: '记录消耗' })
    await user.clear(within(dialog).getByLabelText('类别'))
    await user.type(within(dialog).getByLabelText('类别'), '营养补充')
    await user.clear(within(dialog).getByLabelText('数量'))
    await user.type(within(dialog).getByLabelText('数量'), '2')
    await user.clear(within(dialog).getByLabelText('单位'))
    await user.type(within(dialog).getByLabelText('单位'), '盒')
    await user.clear(within(dialog).getByLabelText('花费'))
    await user.type(within(dialog).getByLabelText('花费'), '88')
    await user.click(within(dialog).getByRole('button', { name: '保存记录' }))

    expect(await screen.findByText('营养补充')).toBeInTheDocument()
  })

  it('switches memory modes and adds a warm daily memory', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '记忆星河' }))
    expect(await screen.findByRole('heading', { name: '记忆星河' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '2D 回忆画廊' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '成长回顾' }))
    expect(screen.getByText('四季时间长廊')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '添加回忆' }))
    const dialog = screen.getByRole('dialog', { name: '添加回忆' })
    await user.type(within(dialog).getByLabelText('日期'), '2026-06-28')
    await user.selectOptions(within(dialog).getByLabelText('心情'), '开心')
    await user.type(within(dialog).getByLabelText('留言'), '今天学会了新的握手动作。')
    await user.click(within(dialog).getByRole('button', { name: '保存回忆' }))

    expect(await screen.findByText('今天学会了新的握手动作。')).toBeInTheDocument()
  })

  it('adds a new pet role card', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '迎接新的家庭成员' }))
    const dialog = screen.getByRole('dialog', { name: '添加宠物' })
    await user.type(within(dialog).getByLabelText('名字'), '奶糖')
    await user.type(within(dialog).getByLabelText('品种'), '萨摩耶')
    await user.type(within(dialog).getByLabelText('生日'), '2025-05-01')
    await user.type(within(dialog).getByLabelText('当前体重（kg）'), '18.5')
    await user.click(within(dialog).getByRole('button', { name: '保存宠物' }))

    expect(await screen.findByRole('button', { name: '选择奶糖' })).toBeInTheDocument()
  })
})
