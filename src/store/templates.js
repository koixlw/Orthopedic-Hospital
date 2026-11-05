// OBJ-MSG-003 短信通知模板（招标第 6、7 项：模板可自定义）
// 正文用 {变量名} 占位，发送时按患者与排程实时渲染；编辑走 assertCan + 留痕
import dayjs from 'dayjs'
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { DEFAULT_TEMPLATES, TPL_VARS } from '@/mock/dict'
import { fmtDate, fmtTime } from '@/utils/format'

export { TPL_VARS }

export const TPL_LABEL = {
  APPOINTMENT_SUCCESS: '手术预约成功通知',
  PRE_ADMISSION: '入院前提醒通知',
  SCHEDULE_CHANGE: '手术安排变动通知'
}

/** 短信计费口径：70 字为一条，模板上限按 300 字控制 */
export const TPL_MAX = 300
export const HOSPITAL = '四川省骨科医院'
export const HOTLINE = '028-8888 6120'

export function list() {
  return state.templates || []
}

export function get(key) {
  return list().find((t) => t.key === key) || null
}

export function defaultOf(key) {
  const d = DEFAULT_TEMPLATES.find((t) => t.key === key)
  return d ? d.content : ''
}

export function isCustomized(key) {
  const t = get(key)
  return !!t && t.content !== defaultOf(key)
}

export function updatedText(key) {
  const t = get(key)
  if (!t || !t.updatedAt) return '使用系统默认模板'
  return '上次修改 ' + t.updatedAt + ' · ' + (t.updatedBy || '管理员')
}

/** 模板里的变量名集合（去重） */
export function varsIn(content) {
  const out = []
  String(content || '').replace(/\{([^{}]*)\}/g, (_, k) => {
    const name = k.trim()
    if (name && !out.includes(name)) out.push(name)
    return ''
  })
  return out
}

/** 渲染任意正文：未知变量按空串处理，避免患者收到带 {占位符} 的短信 */
export function renderText(content, vars = {}) {
  const ctx = { 医院名称: HOSPITAL, 联系电话: HOTLINE, ...vars }
  return String(content || '').replace(/\{([^{}]*)\}/g, (_, raw) => {
    const k = raw.trim()
    const v = ctx[k]
    return v === undefined || v === null ? '' : String(v)
  })
}

/** 按模板 key 渲染 */
export function render(key, vars = {}) {
  const t = get(key)
  return t ? renderText(t.content, vars) : ''
}

function weekText(date) {
  return '周' + ['日', '一', '二', '三', '四', '五', '六'][dayjs(date).day()]
}

/** 从患者与排程造一份变量，供预览与真实发送共用 */
export function buildVars(patientId, extra = {}) {
  const p = getPatient(patientId) || state.patients[0] || null
  const sch = p
    ? state.schedules.find((s) => s.patientId === p.patientId && ['SCHEDULED', 'CHANGED', 'CHECKED_IN'].includes(s.status))
    : null
  const date = sch?.surgeryDate || p?.plannedSurgeryDate || fmtDate(new Date())
  const vars = {
    患者姓名: p?.name || '患者',
    患者性别: p?.gender || '',
    住院号: p?.inpatientNo || '',
    科室: p?.dept || '关节外科',
    手术日期: fmtDate(date),
    星期: weekText(date),
    手术间: sch?.room || p?.surgeryRoom || '日间 1 间',
    台次: String(sch?.seq || 1),
    主刀: sch?.surgeon || p?.surgeon || '张海涛',
    麻醉方式: sch?.anesthesiaType || '椎管内麻醉',
    禁食提示: state.settings.fastingTip || '术前 8 小时禁食、4 小时禁饮。',
    提前天数: String(state.settings.preAdmissionNoticeDays || 1),
    原日期: fmtDate(date),
    原手术间: sch?.bookedRoom || sch?.room || '日间 1 间',
    原台次: String(sch?.bookedSeq || sch?.seq || 1)
  }
  return { ...vars, ...extra }
}

/** 页面预览：用真实患者渲染，未选患者时取第一位 */
export function preview(key, patientId) {
  return render(key, buildVars(patientId))
}

/** 校验收口：空、超长、未知变量、缺患者姓名都当场拒绝，原因中文可读 */
export function validate(content) {
  const text = String(content || '')
  if (!text.trim()) throw new Error('短信正文不能为空')
  if (text.length > TPL_MAX) throw new Error(`短信正文不能超过 ${TPL_MAX} 字（当前 ${text.length} 字）`)
  if (!varsIn(text).includes('患者姓名')) throw new Error('短信正文必须包含 {患者姓名} 变量，否则患者不知道这条短信是给谁的')
  const known = TPL_VARS.map((v) => v.key)
  const unknown = varsIn(text).filter((k) => !known.includes(k))
  if (unknown.length) throw new Error(`存在未知变量：{${unknown.join('}、{')}}，请从下方变量列表中插入`)
  const open = (text.match(/\{/g) || []).length
  const close = (text.match(/\}/g) || []).length
  if (open !== close) throw new Error('变量占位符不完整，请检查花括号是否成对')
  return true
}

/** 保存模板：只有管理员可改；改完立即生效于下一次发送 */
export function save(key, content) {
  assertCan('msg.tpl', {
    module: 'MSG', page: '消息通知', action: 'UPDATE',
    label: '修改短信通知模板', targetType: '通知模板', targetId: key, targetName: TPL_LABEL[key] || key
  })
  const t = get(key)
  if (!t) throw new Error('未找到该通知模板')
  const text = String(content || '').replace(/\r\n/g, '\n')
  validate(text)

  const before = { 模板名称: t.name, 模板正文: t.content }
  t.content = text
  t.updatedAt = fmtTime(new Date())
  t.updatedBy = state.session.name + '（' + state.session.roleLabel + '）'
  t.version = (t.version || 1) + 1

  log({
    module: 'MSG', page: '消息通知', action: 'UPDATE',
    targetType: '通知模板', targetId: key, targetName: t.name,
    patientId: null, before, after: { 模板名称: t.name, 模板正文: text },
    reason: '修改短信通知模板（' + t.name + '），第 ' + t.version + ' 版'
  })
  persist()
  return t
}

/** 恢复系统默认模板 */
export function restore(key) {
  assertCan('msg.tpl', {
    module: 'MSG', page: '消息通知', action: 'UPDATE',
    label: '恢复默认短信模板', targetType: '通知模板', targetId: key, targetName: TPL_LABEL[key] || key
  })
  const t = get(key)
  if (!t) throw new Error('未找到该通知模板')
  const before = { 模板正文: t.content }
  t.content = defaultOf(key)
  t.updatedAt = fmtTime(new Date())
  t.updatedBy = state.session.name + '（' + state.session.roleLabel + '）'
  t.version = (t.version || 1) + 1
  log({
    module: 'MSG', page: '消息通知', action: 'UPDATE',
    targetType: '通知模板', targetId: key, targetName: t.name,
    patientId: null, before, after: { 模板正文: t.content },
    reason: '恢复系统默认模板（' + t.name + '）'
  })
  persist()
  return t
}
