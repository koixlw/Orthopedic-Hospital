// 全局响应式状态 + localStorage 持久化（5.8）
// 键名固定 PREOP_DEMO_V9；读不到就用种子数据，不做版本兼容迁移
import { reactive } from 'vue'
import {
  seedPatients, seedAccounts, seedApplies, seedEvals, seedSchedules,
  seedCheckins, seedMessages, seedSettings, seedChargeItems, seedDrugs,
  seedGroups, seedEvalReasons, seedCharges, seedOrders, seedLogs,
  seedTemplates, DEFAULT_TEMPLATES, TODAY, reportProgressOf
} from '@/mock/dict'
import {
  extraPatients, extraAccounts, extraApplies, extraEvals, extraSchedules,
  extraCheckins, extraMessages, extraCharges, extraOrders,
  extraChargeItems, extraGroups, buildExtraLogs
} from '@/mock/extra'

// 键名固定 PREOP_DEMO_V9；读不到就用种子数据，不做版本兼容迁移
export const STORAGE_KEY = 'PREOP_DEMO_V9'
export const LOG_MAX = 2000
// 默认登录为演示管理员：拥有全部权限，打开即进主界面（4.1 演示默认角色）
export const DEFAULT_SESSION = { role: 'ADMIN', name: '李伟', roleLabel: '系统管理员', account: 'A0001', loggedIn: true, loginAt: '' }

function emptyState() {
  return {
    patients: [],
    accounts: [],
    applies: [],
    evals: [],
    schedules: [],
    checkins: [],
    messages: [],
    charges: [],
    orders: [],
    dicts: { items: [], drugs: [], groups: [], evalReasons: [] },
    settings: {},
    templates: [],
    // 日志用对象包一层：list 只追加，seq 连续，overflow 达上限标记
    logs: { list: [], seq: 0, overflow: false },
    session: { ...DEFAULT_SESSION },
    currentPatientId: 'P001'
  }
}

export const state = reactive(emptyState())

export function seedAll() {
  // 初始种子（dict.js）覆盖「每个状态一个主角」；补充种子（extra.js）覆盖其余业务分支
  state.patients = seedPatients()
    .concat(extraPatients)
    .map((p) => ({ ...p, reportProgress: p.reportProgress || reportProgressOf(p.patientId) }))
  state.accounts = seedAccounts().concat(extraAccounts)
  state.applies = seedApplies().concat(extraApplies)
  state.evals = seedEvals().concat(extraEvals)
  state.schedules = seedSchedules().concat(extraSchedules)
  state.checkins = seedCheckins().concat(extraCheckins)
  state.messages = seedMessages().concat(extraMessages)
  state.charges = seedCharges().concat(extraCharges)
  state.orders = seedOrders().concat(extraOrders)
  state.dicts = {
    items: seedChargeItems().concat(extraChargeItems),
    drugs: seedDrugs(),
    groups: seedGroups().concat(extraGroups),
    evalReasons: seedEvalReasons()
  }
  state.settings = seedSettings()
  state.templates = seedTemplates()
  const logs = seedLogs().concat(buildExtraLogs(seedLogs().length + 1))
  state.logs = { list: logs, seq: logs.length, overflow: false }
  state.session = { ...DEFAULT_SESSION }
  state.currentPatientId = 'P001'
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('[persist] 写入 localStorage 失败', e)
  }
}

export function hydrate() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    raw = null
  }
  if (!raw) {
    seedAll()
    persist()
    return
  }
  try {
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.patients) || !data.patients.length) {
      seedAll()
      persist()
      return
    }
    const base = emptyState()
    Object.keys(base).forEach((k) => {
      if (data[k] === undefined || data[k] === null) return
      state[k] = data[k]
    })
    if (!state.dicts || !Array.isArray(state.dicts.items) || !state.dicts.items.length) {
      seedAll()
      return
    }
    if (!state.logs || !Array.isArray(state.logs.list)) {
      const logs = seedLogs()
      state.logs = { list: logs, seq: logs.length, overflow: false }
    }
    if (!state.session || !state.session.role) state.session = { ...DEFAULT_SESSION }
    if (state.session.loggedIn === undefined) state.session.loggedIn = true
    if (!state.settings || !state.settings.updatedAt) {
      state.settings = { ...seedSettings(), ...(state.settings || {}) }
    }
    // 演示数据是相对今天生成的：缓存快照里若今天没有排程、也没有未来排程，
    // 说明这份快照已经过期（换了一天），重新播种，保证「今日待报到」始终有素材
    const hasToday = state.schedules.some((s) => s.surgeryDate === TODAY)
    const hasFuture = state.schedules.some((s) => s.surgeryDate > TODAY)
    if (!hasToday && !hasFuture) {
      console.info('[hydrate] 演示数据快照已过期，按今天重新播种')
      seedAll()
      persist()
      return
    }
    // 模板是后加的：旧缓存补默认，缺哪个补哪个，不覆盖已改过的正文
    if (!Array.isArray(state.templates) || !state.templates.length) {
      state.templates = seedTemplates()
    } else {
      DEFAULT_TEMPLATES.forEach((d) => {
        if (!state.templates.some((t) => t.key === d.key)) {
          state.templates.push({ ...d, updatedAt: '', updatedBy: '' })
        }
      })
    }
  } catch (e) {
    console.error('[hydrate] 数据损坏，回退到种子数据', e)
    seedAll()
    persist()
  }
}

/** 重置演示数据：全站唯一允许的「真删」（RULE-COM-001 例外条款） */
export function resetAll() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error(e)
  }
  location.hash = '#/workbench'
  location.reload()
}

/** 取患者，不存在抛错 */
export function mustPatient(patientId) {
  const p = state.patients.find((x) => x.patientId === patientId)
  if (!p) throw new Error('未找到该患者')
  return p
}
