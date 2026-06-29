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
    expect(screen.queryByRole('button', { name: '添加回忆' })).not.toBeInTheDocument()
  })

  it('lets the user complete and postpone care tasks', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '今天也一起好好生活' })
    await user.click(screen.getByRole('button', { name: '完成驱虫' }))
    expect(screen.getByText('驱虫已完成')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '稍后处理月度体重' }))
    expect(screen.getByText('月度体重已稍后提醒')).toBeInTheDocument()
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
    expect(screen.getAllByText('治疗中').length).toBeGreaterThan(0)
  })

  it('filters, opens and deletes a medical record', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '健康档案' }))
    const search = await screen.findByRole('searchbox', { name: '搜索病历' })
    await user.type(search, '消化')
    expect(screen.getByText('轻度消化不良')).toBeInTheDocument()
    expect(screen.queryByText('各项指标正常')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看轻度消化不良详情' }))
    const detail = screen.getByRole('dialog', { name: '病历详情' })
    expect(within(detail).getByText('宠物益生菌，每日一次')).toBeInTheDocument()
    await user.click(within(detail).getByRole('button', { name: '删除病历' }))
    const confirm = screen.getByRole('dialog', { name: '删除这条病历？' })
    await user.click(within(confirm).getByRole('button', { name: '确认删除' }))

    expect(await screen.findByText('没有找到符合条件的病历')).toBeInTheDocument()
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

    expect((await screen.findAllByText('营养补充')).length).toBeGreaterThan(0)
  })

  it('filters and deletes monthly care records with confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '生活记录' }))
    await screen.findByRole('heading', { name: '生活记录' })
    await user.click(screen.getByRole('button', { name: '只看洗澡' }))
    expect(screen.getByText('2 次')).toBeInTheDocument()
    expect(screen.queryByText('6 kg')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除洗澡记录' }))
    const confirm = screen.getByRole('dialog', { name: '删除这条消耗记录？' })
    await user.click(within(confirm).getByRole('button', { name: '确认删除' }))
    expect(await screen.findByText('这个筛选下还没有记录')).toBeInTheDocument()
  })

  it('uses four non-3d product routes and switches pets globally', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: '今天也一起好好生活' })).toBeInTheDocument()
    const navigation = screen.getByRole('navigation', { name: '主导航' })
    expect(within(navigation).getAllByRole('link')).toHaveLength(4)
    expect(within(navigation).queryByRole('link', { name: '记忆星河' })).not.toBeInTheDocument()

    await user.click(within(navigation).getByRole('link', { name: '宠物档案' }))
    expect(await screen.findByRole('heading', { name: '宠物档案' })).toBeInTheDocument()
    expect(screen.getByText('豆包的照护档案')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('当前宠物'), 'pet-mili')
    expect(await screen.findByText('米粒的照护档案')).toBeInTheDocument()
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
