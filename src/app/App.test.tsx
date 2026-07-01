import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSeedState } from '../data/seed'
import { App } from './App'

describe('PetPlanet app', () => {
  beforeEach(() => {
    localStorage.clear()
    const state = createSeedState()
    const month = new Date().toISOString().slice(0, 7)
    state.consumptions = state.consumptions.map((entry) => ({ ...entry, month }))
    localStorage.setItem('petplanet:data:v1', JSON.stringify(state))
    window.history.replaceState({}, '', '/')
  })

  it('shows one current pet hero and switches it from the global selector', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: '今天也一起好好生活' })).toBeInTheDocument()
    const hero = screen.getByTestId('current-pet-hero')
    expect(within(hero).getByRole('heading', { name: '豆包' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择米粒' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择糖糖' })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('当前宠物'), 'pet-mili')
    expect(within(screen.getByTestId('current-pet-hero')).getByRole('heading', { name: '米粒' })).toBeInTheDocument()
  })

  it('organizes the home into overview, reminders, quick records, care progress and memories', async () => {
    render(<App />)

    await screen.findByRole('heading', { name: '今天也一起好好生活' })
    expect(screen.getByTestId('current-pet-hero')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '今日关键提醒' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '快捷记录' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '今日照护进度' })).toBeInTheDocument()
    expect(screen.getByTestId('monthly-bento')).toBeInTheDocument()
    expect(screen.getByTestId('memory-preview')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '记录喂食' })).toHaveAttribute('href', '/daily?new=feeding')
    expect(screen.getByRole('link', { name: '打开生活回忆' })).toHaveAttribute('href', '/memories')
  })

  it('adds and persists a todo for the current pet', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    expect(await screen.findByRole('heading', { name: '今日关键提醒' })).toBeInTheDocument()
    expect(screen.queryByText('今日照护')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加待办' }))

    const dialog = screen.getByRole('dialog', { name: '添加待办' })
    await user.type(within(dialog).getByLabelText('待办事项'), '补充益生菌')
    await user.type(within(dialog).getByLabelText('描述'), '晚饭后半袋')
    await user.type(within(dialog).getByLabelText('截至时间'), '2026-07-01T18:30')
    await user.click(within(dialog).getByRole('button', { name: '保存待办' }))

    expect(await screen.findByText('补充益生菌')).toBeInTheDocument()
    expect(screen.getByText('晚饭后半袋')).toBeInTheDocument()
    unmount()
    render(<App />)
    expect(await screen.findByText('补充益生菌')).toBeInTheDocument()
  })

  it('validates todos and keeps them scoped to the current pet', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '添加待办' }))
    await user.click(screen.getByRole('button', { name: '保存待办' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请填写待办事项和截至时间')

    const dialog = screen.getByRole('dialog', { name: '添加待办' })
    await user.type(within(dialog).getByLabelText('待办事项'), '补充益生菌')
    await user.type(within(dialog).getByLabelText('截至时间'), '2026-07-01T18:30')
    await user.click(within(dialog).getByRole('button', { name: '保存待办' }))
    await user.selectOptions(screen.getByLabelText('当前宠物'), 'pet-mili')
    expect(screen.queryByText('补充益生菌')).not.toBeInTheDocument()
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

  it('navigates to health and daily records from the primary navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '健康' }))
    expect(await screen.findByRole('heading', { name: '健康档案' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增病历' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '日常' }))
    expect(await screen.findByRole('heading', { name: '日常记录' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '记录体重' })).toBeInTheDocument()
  })

  it('offers one complete global quick record menu', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '快速记录' }))
    const menu = screen.getByRole('menu', { name: '快速记录菜单' })
    expect(within(menu).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '记录喂食',
      '记录饮水',
      '记录体重',
      '记录消耗',
      '新增病历',
      '添加照片 / 回忆',
    ])
    expect(within(menu).getByRole('link', { name: '记录喂食' })).toHaveAttribute('href', '/daily?new=feeding')
  })

  it('adds a medical record from the health page', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '健康' }))
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

    await user.click(screen.getByRole('link', { name: '健康' }))
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

    await user.click(screen.getByRole('link', { name: '日常' }))
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

  it('records separate feeding and water events in the daily care timeline', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/daily')
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '记录喂食' }))
    const feedingDialog = screen.getByRole('dialog', { name: '记录喂食' })
    await user.type(within(feedingDialog).getByLabelText('发生时间'), '2026-06-30T08:30')
    await user.type(within(feedingDialog).getByLabelText('数量（g）'), '180')
    await user.click(within(feedingDialog).getByRole('button', { name: '保存喂食' }))

    expect(await screen.findByText('180 g')).toBeInTheDocument()
    expect(screen.getByText('08:30')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '记录饮水' }))
    const waterDialog = screen.getByRole('dialog', { name: '记录饮水' })
    await user.type(within(waterDialog).getByLabelText('发生时间'), '2026-06-30T10:15')
    await user.type(within(waterDialog).getByLabelText('数量（ml）'), '250')
    await user.click(within(waterDialog).getByRole('button', { name: '保存饮水' }))

    expect(await screen.findByText('250 ml')).toBeInTheDocument()
    expect(screen.getByText('10:15')).toBeInTheDocument()
  })

  it('adds a dated photo to the aggregated life photo area', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/daily')
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '上传照片' }))
    const dialog = screen.getByRole('dialog', { name: '添加生活照片' })
    await user.type(within(dialog).getByLabelText('拍摄时间'), '2026-06-28T16:20')
    await user.type(within(dialog).getByLabelText('一句话说明'), '草地上的下午')
    await user.upload(
      within(dialog).getByLabelText('照片'),
      new File(['pet-photo'], 'afternoon.jpg', { type: 'image/jpeg' }),
    )
    expect((within(dialog).getByLabelText('照片') as HTMLInputElement).files?.[0].size).toBeGreaterThan(0)
    await user.click(within(dialog).getByRole('button', { name: '保存照片' }))

    await waitFor(() => expect(localStorage.getItem('petplanet:data:v1')).toContain('草地上的下午'))
    expect(await screen.findByText('草地上的下午')).toBeInTheDocument()
  })

  it('filters and deletes monthly care records with confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: '日常' }))
    await screen.findByRole('heading', { name: '日常记录' })
    await user.click(screen.getByRole('button', { name: '只看洗澡' }))
    expect(screen.getByText('2 次')).toBeInTheDocument()
    expect(screen.queryByText('6 kg')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除洗澡记录' }))
    const confirm = screen.getByRole('dialog', { name: '删除这条消耗记录？' })
    await user.click(within(confirm).getByRole('button', { name: '确认删除' }))
    expect(await screen.findByText('这个筛选下还没有记录')).toBeInTheDocument()
  })

  it('uses the new home, daily, health, memories and profile navigation', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: '今天也一起好好生活' })).toBeInTheDocument()
    const navigation = screen.getByRole('navigation', { name: '主导航' })
    expect(within(navigation).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '首页', '日常', '健康', '回忆', '档案',
    ])
    expect(within(navigation).getByRole('link', { name: '日常' })).toHaveAttribute('href', '/daily')
    expect(within(navigation).getByRole('link', { name: '档案' })).toHaveAttribute('href', '/profile')

    await user.click(within(navigation).getByRole('link', { name: '档案' }))
    expect(await screen.findByRole('heading', { name: '宠物档案' })).toBeInTheDocument()
    expect(screen.getByText('豆包的照护档案')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('当前宠物'), 'pet-mili')
    expect(await screen.findByText('米粒的照护档案')).toBeInTheDocument()
  })

  it('keeps legacy life and pets URLs working', async () => {
    window.history.replaceState({}, '', '/life?new=weight')
    render(<App />)

    expect(await screen.findByRole('dialog', { name: '记录体重' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/daily')
    expect(window.location.search).toBe('?new=weight')
  })

  it('keeps memories in 2D and shows the future 3D entry as a preview only', async () => {
    window.history.replaceState({}, '', '/memories')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '生活回忆' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '成长概览' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '闪光回忆' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '季节时间线' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '2D 回忆画廊' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '未来 3D 记忆星河' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '3D 星河' })).not.toBeInTheDocument()
  })

  it('opens the add-memory form from a deep link', async () => {
    window.history.replaceState({}, '', '/memories?new=1')
    render(<App />)

    expect(await screen.findByRole('dialog', { name: '添加回忆' })).toBeInTheDocument()
  })

  it('keeps add and edit pet management inside the profile page', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/profile')
    render(<App />)

    expect(await screen.findByRole('heading', { name: '宠物档案' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加宠物' }))
    expect(screen.getByRole('dialog', { name: '添加宠物' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    await user.click(screen.getByRole('button', { name: '编辑资料' }))
    expect(screen.getByRole('dialog', { name: '编辑宠物资料' })).toBeInTheDocument()
  })

  it('keeps the add-pet flow available', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('link', { name: '添加宠物' }))
    const dialog = screen.getByRole('dialog', { name: '添加宠物' })
    await user.type(within(dialog).getByLabelText('名字'), '奶糖')
    await user.type(within(dialog).getByLabelText('品种'), '萨摩耶')
    await user.type(within(dialog).getByLabelText('生日'), '2025-05-01')
    await user.type(within(dialog).getByLabelText('当前体重（kg）'), '18.5')
    await user.click(within(dialog).getByRole('button', { name: '保存宠物' }))

    expect(window.location.pathname).toBe('/profile')
    expect(await screen.findByText('奶糖的照护档案')).toBeInTheDocument()
  })
})
