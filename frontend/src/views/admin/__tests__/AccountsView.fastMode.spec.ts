import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'

const {
  listAccounts,
  listWithEtag,
  getBatchTodayStats,
  getAllProxies,
  getAllGroups,
  bulkUpdate,
  showError
} = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  listWithEtag: vi.fn(),
  getBatchTodayStats: vi.fn(),
  getAllProxies: vi.fn(),
  getAllGroups: vi.fn(),
  bulkUpdate: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag,
      getBatchTodayStats,
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({ enabled: true, interval_minutes: 30 }),
      bulkUpdate,
      delete: vi.fn(),
      batchClearError: vi.fn(),
      batchRefresh: vi.fn()
    },
    proxies: {
      getAll: getAllProxies
    },
    groups: {
      getAll: getAllGroups
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError,
    showSuccess: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    token: 'test-token',
    isSimpleMode: false
  })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const DataTableStub = {
  props: ['columns', 'data'],
  template: `
    <div data-test="data-table">
      <span v-for="column in columns" :key="column.key" data-test="column-key">{{ column.key }}</span>
      <div v-for="row in data" :key="row.id" :data-test="'row-' + row.id">
        <slot name="cell-openai_fast_mode" :row="row" />
      </div>
    </div>
  `
}

const baseAccount = {
  type: 'apikey',
  status: 'active',
  schedulable: true,
  concurrency: 1,
  priority: 0,
  error_message: null,
  last_used_at: null,
  expires_at: null,
  auto_pause_on_expired: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
}

function mountView() {
  return mount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: {
          template: '<div><slot name="filters" /><slot name="table" /><slot name="pagination" /></div>'
        },
        DataTable: DataTableStub,
        HelpTooltip: true,
        Pagination: true,
        ConfirmDialog: true,
        AccountTableActions: { template: '<div><slot name="after" /></div>' },
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        AccountActionMenu: true,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: true,
        AccountStatsModal: true,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: true,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountGroupsCell: true,
        AccountUsageCell: true,
        Icon: true
      }
    }
  })
}

describe('admin AccountsView OpenAI Fast mode column', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    listAccounts.mockResolvedValue({
      items: [
        {
          ...baseAccount,
          id: 1,
          name: 'openai-standard',
          platform: 'openai',
          extra: { existing_setting: 'preserved' }
        },
        {
          ...baseAccount,
          id: 2,
          name: 'openai-fast',
          platform: 'openai',
          extra: { openai_fast_mode: true }
        },
        {
          ...baseAccount,
          id: 3,
          name: 'anthropic-account',
          platform: 'anthropic',
          extra: {}
        }
      ],
      total: 3,
      page: 1,
      page_size: 20,
      pages: 1
    })
    listWithEtag.mockResolvedValue({ notModified: true, etag: null, data: null })
    getBatchTodayStats.mockResolvedValue({ stats: {} })
    getAllProxies.mockResolvedValue([])
    getAllGroups.mockResolvedValue([])
  })

  it('places the Fast mode column after scheduling and only renders switches for OpenAI accounts', async () => {
    const wrapper = mountView()
    await flushPromises()

    const columnKeys = wrapper.findAll('[data-test="column-key"]').map(node => node.text())
    expect(columnKeys.indexOf('openai_fast_mode')).toBe(columnKeys.indexOf('schedulable') + 1)

    expect(wrapper.get('[data-test="openai-fast-mode-1"]').attributes('aria-checked')).toBe('false')
    expect(wrapper.get('[data-test="openai-fast-mode-2"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-test="openai-fast-mode-3"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="row-3"]').text()).toBe('-')
  })

  it('persists the Fast mode flag as an incremental extra update and refreshes the row', async () => {
    bulkUpdate.mockResolvedValue({
      success: 1,
      failed: 0,
      success_ids: [1],
      failed_ids: [],
      results: [{ account_id: 1, success: true }]
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="openai-fast-mode-1"]').trigger('click')
    await flushPromises()

    expect(bulkUpdate).toHaveBeenCalledWith([1], {
      extra: { openai_fast_mode: true }
    })
    expect(wrapper.get('[data-test="openai-fast-mode-1"]').attributes('aria-checked')).toBe('true')
  })

  it('keeps the previous state and reports an error when the update fails', async () => {
    bulkUpdate.mockRejectedValue(new Error('request failed'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="openai-fast-mode-1"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="openai-fast-mode-1"]').attributes('aria-checked')).toBe('false')
    expect(showError).toHaveBeenCalledWith('admin.accounts.failedToToggleOpenAIFastMode')
  })
})
