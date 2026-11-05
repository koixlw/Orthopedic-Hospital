// OBJ-CHG-001 / 002 手术费用单与费用明细（3.7 / 3.8）
// ▲招标第 12 项：手工补录 + 常用组套调入两条路径
// 零物理删除（RULE-COM-001）：草稿行「移除」软删可恢复，已提交单「作废」永久保留
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { fmtAmount, fmtTime, round2 } from '@/utils/format'

export const SHEET_STATUS = {
  DRAFT: { label: '编辑中', type: 'primary' },
  SUBMITTED: { label: '已提交', type: 'success' },
  VOIDED: { label: '已作废', type: 'info' }
}

export function listOf(patientId) {
  return state.charges.filter((c) => c.patientId === patientId)
}

export function getSheet(chargeId) {
  return state.charges.find((c) => c.chargeId === chargeId) || null
}

/** 该患者当前编辑中的费用单（没有则 null） */
export function active(patientId) {
  return state.charges.find((c) => c.patientId === patientId && c.status === 'DRAFT') || null
}

function nextChargeId() {
  return 'CJ' + fmtTime(new Date()).slice(0, 10).replace(/-/g, '') + String(state.charges.length + 1).padStart(3, '0')
}

function newSheet(patientId, from) {
  return {
    chargeId: nextChargeId(),
    patientId,
    status: 'DRAFT',
    groupName: from ? from.groupName : '',
    lines: from ? from.lines.map((l) => ({ ...l, removed: false, removeReason: '', removedBy: '', removedAt: '' })) : [],
    total: 0,
    submittedAt: '',
    submittedBy: '',
    voidReason: '',
    voidedAt: '',
    createdAt: fmtTime(new Date()),
    createdBy: state.session.name
  }
}

/** 取草稿单，没有就建一张（页面不得自己 push 数组） */
export function ensureDraft(patientId) {
  const cur = active(patientId)
  if (cur) return cur
  const sheet = newSheet(patientId)
  state.charges.push(sheet)
  persist()
  return sheet
}

export function totalOf(sheet) {
  if (!sheet) return 0
  return round2(sheet.lines.filter((l) => !l.removed).reduce((s, l) => s + Number(l.amount || 0), 0))
}

function touch(sheet) {
  sheet.total = totalOf(sheet)
}

function patientLabel(patientId) {
  const p = getPatient(patientId)
  return p ? p.name + ' ' + p.inpatientNo : patientId
}

function assertDraft(sheet) {
  if (!sheet) throw new Error('该患者尚无费用单，请先录入')
  if (sheet.status === 'SUBMITTED') throw new Error('费用单已提交，不能修改明细；如需更正请先作废')
  if (sheet.status === 'VOIDED') throw new Error('费用单已作废，请点击「重新录入」后再编辑')
}

function nextLineId(sheet) {
  return 'FI' + String(sheet.lines.length + 1).padStart(4, '0') + '-' + String(Date.now()).slice(-4)
}

/* ---------------- FUNC-CHG-001 手工补录 ---------------- */
export function addLine(patientId, item, qty = 1) {
  assertCan('chg.add', { module: 'CHG', page: '手术费用', action: 'CREATE', label: '录入手术费用', targetType: '费用明细' })
  if (!item) throw new Error('请选择收费项目')
  const sheet = ensureDraft(patientId)
  assertDraft(sheet)
  const n = Number(qty) || 1
  if (!(n > 0)) throw new Error('数量必须大于 0')
  const price = Number(item.price || 0)
  const line = {
    chargeItemId: nextLineId(sheet),
    code: item.code || '',
    name: item.name || '',
    spec: item.spec || '',
    unit: item.unit || '',
    qty: n,
    price,
    amount: round2(n * price),
    removed: false,
    removeReason: '',
    removedBy: '',
    removedAt: ''
  }
  sheet.lines.push(line)
  touch(sheet)
  log({
    module: 'CHG', page: '手术费用', action: 'CREATE',
    targetType: '费用明细', targetId: line.chargeItemId, targetName: line.name,
    patientId, before: null,
    after: { 项目: line.name, 数量: line.qty, 单价: fmtAmount(line.price), 金额: fmtAmount(line.amount) },
    reason: '手工补录手术费用'
  })
  persist()
  return line
}

/* ---------------- FUNC-CHG-002 常用组套调入 ---------------- */
export function importGroup(patientId, group) {
  assertCan('chg.import', { module: 'CHG', page: '手术费用', action: 'CREATE', label: '调入费用组套', targetType: '费用明细' })
  if (!group) throw new Error('请选择费用组套')
  const sheet = ensureDraft(patientId)
  assertDraft(sheet)
  const added = []
  group.lines.forEach((gl) => {
    const qty = Number(gl.qty || 1)
    const price = Number(gl.price || 0)
    const line = {
      chargeItemId: nextLineId(sheet),
      code: gl.code,
      name: gl.name,
      spec: gl.spec,
      unit: gl.unit,
      qty,
      price,
      amount: round2(qty * price),
      removed: false,
      removeReason: '',
      removedBy: '',
      removedAt: ''
    }
    sheet.lines.push(line)
    added.push(line)
  })
  sheet.groupName = group.name
  touch(sheet)
  // 一次用户操作 = 一条日志（不是 8 条）
  log({
    module: 'CHG', page: '手术费用', action: 'CREATE',
    targetType: '费用单', targetId: sheet.chargeId, targetName: patientLabel(patientId),
    patientId, before: null,
    after: { 组套: group.name, 明细条数: added.length, 合计: fmtAmount(sheet.total) },
    reason: '调入常用组套「' + group.name + '」' + added.length + ' 条明细'
  })
  persist()
  return added
}

/* ---------------- FUNC-CHG-004 修改明细行 ---------------- */
export function patchLine(patientId, lineId, patch = {}) {
  const sheet = active(patientId)
  assertDraft(sheet)
  const line = sheet.lines.find((l) => l.chargeItemId === lineId)
  if (!line) throw new Error('未找到该费用明细')
  if (line.removed) throw new Error('已移除的明细不能修改，请先恢复')
  const before = { 数量: line.qty, 单价: fmtAmount(line.price), 金额: fmtAmount(line.amount) }
  if (patch.qty !== undefined) {
    const q = Number(patch.qty)
    if (!(q > 0)) throw new Error('数量必须大于 0')
    line.qty = q
  }
  if (patch.price !== undefined) {
    const pr = Number(patch.price)
    if (pr < 0) throw new Error('单价不能为负')
    line.price = pr
  }
  line.amount = round2(line.qty * line.price)
  touch(sheet)
  log({
    module: 'CHG', page: '手术费用', action: 'UPDATE',
    targetType: '费用明细', targetId: line.chargeItemId, targetName: line.name,
    patientId, before,
    after: { 数量: line.qty, 单价: fmtAmount(line.price), 金额: fmtAmount(line.amount) },
    reason: patch.reason || '修改费用明细'
  })
  persist()
  return line
}

/* ---------------- FUNC-CHG-005 移除明细（软删可恢复） ---------------- */
export function removeLine(patientId, lineId, reason = '') {
  assertCan('chg.add', { module: 'CHG', page: '手术费用', action: 'REMOVE', label: '移除费用明细', targetType: '费用明细' })
  const sheet = active(patientId)
  assertDraft(sheet)
  const line = sheet.lines.find((l) => l.chargeItemId === lineId)
  if (!line) throw new Error('未找到该费用明细')
  if (line.removed) throw new Error('该明细已移除，不能重复移除')
  const before = { 项目: line.name, 数量: line.qty, 金额: fmtAmount(line.amount), 状态: '正常' }
  line.removed = true
  line.removeReason = reason
  line.removedBy = state.session.name
  line.removedAt = fmtTime(new Date())
  touch(sheet)
  log({
    module: 'CHG', page: '手术费用', action: 'REMOVE',
    targetType: '费用明细', targetId: line.chargeItemId, targetName: line.name,
    patientId, before,
    after: { 状态: '已移除（可恢复）', 移除后合计: fmtAmount(sheet.total) },
    reason
  })
  persist()
  return line
}

export function restoreLine(patientId, lineId) {
  assertCan('chg.add', { module: 'CHG', page: '手术费用', action: 'UPDATE', label: '恢复费用明细', targetType: '费用明细' })
  const sheet = active(patientId)
  assertDraft(sheet)
  const line = sheet.lines.find((l) => l.chargeItemId === lineId)
  if (!line) throw new Error('未找到该费用明细')
  if (!line.removed) throw new Error('该明细未被移除，无需恢复')
  const before = { 状态: '已移除', 金额: fmtAmount(line.amount) }
  line.removed = false
  line.removeReason = ''
  line.removedBy = ''
  line.removedAt = ''
  touch(sheet)
  log({
    module: 'CHG', page: '手术费用', action: 'UPDATE',
    targetType: '费用明细', targetId: line.chargeItemId, targetName: line.name,
    patientId, before,
    after: { 状态: '正常', 恢复后合计: fmtAmount(sheet.total) },
    reason: '恢复被移除的费用明细'
  })
  persist()
  return line
}

/* ---------------- FUNC-CHG-003 提交手术费用 ---------------- */
export function submit(patientId) {
  assertCan('chg.submit', { module: 'CHG', page: '手术费用', action: 'UPDATE', label: '提交费用单', targetType: '费用单' })
  const sheet = active(patientId)
  if (!sheet) throw new Error('该患者还没有费用草稿')
  const lines = sheet.lines.filter((l) => !l.removed)
  if (!lines.length) throw new Error('请至少录入一条费用明细')
  if (lines.some((l) => !(Number(l.qty) > 0))) throw new Error('存在数量不大于 0 的明细，不能提交')
  const before = { 单据状态: '编辑中', 合计: fmtAmount(sheet.total) }
  touch(sheet)
  sheet.status = 'SUBMITTED'
  sheet.submittedAt = fmtTime(new Date())
  sheet.submittedBy = state.session.name
  log({
    module: 'CHG', page: '手术费用', action: 'STATUS',
    targetType: '费用单', targetId: sheet.chargeId, targetName: patientLabel(patientId),
    patientId, before,
    after: { 单据状态: '已提交', 合计: fmtAmount(sheet.total), 明细条数: lines.length },
    reason: '提交手术费用'
  })
  persist()
  return sheet
}

/* ---------------- FUNC-CHG-006 作废已提交费用单 ---------------- */
export function voidCharge(chargeId, reason) {
  assertCan('chg.void', { module: 'CHG', page: '手术费用', action: 'VOID', label: '作废费用单', targetType: '费用单' })
  const sheet = getSheet(chargeId)
  if (!sheet) throw new Error('未找到该费用单')
  if (sheet.status === 'VOIDED') throw new Error('该费用单已作废，不能重复作废')
  if (sheet.status !== 'SUBMITTED') throw new Error('只有已提交的费用单可以作废')
  if (!reason) throw new Error('请选择作废原因')
  const before = { 单据状态: '已提交', 合计: fmtAmount(sheet.total) }
  sheet.status = 'VOIDED'
  sheet.voidReason = reason
  sheet.voidedAt = fmtTime(new Date())
  log({
    module: 'CHG', page: '手术费用', action: 'VOID',
    targetType: '费用单', targetId: sheet.chargeId, targetName: patientLabel(sheet.patientId),
    patientId: sheet.patientId, before,
    after: { 单据状态: '已作废', 作废原因: reason },
    reason
  })
  persist()
  return sheet
}

/** FUNC-CHG-007 基于已作废单重新录入（生成新草稿，原单永久保留） */
export function reEnter(chargeId) {
  assertCan('chg.reenter', { module: 'CHG', page: '手术费用', action: 'CREATE', label: '重新录入费用', targetType: '费用单' })
  const src = getSheet(chargeId)
  if (!src) throw new Error('未找到该费用单')
  if (src.status !== 'VOIDED') throw new Error('只有已作废的费用单可以重新录入')
  if (active(src.patientId)) throw new Error('该患者已有编辑中的费用单，请直接使用')
  const sheet = newSheet(src.patientId, src)
  touch(sheet)
  state.charges.push(sheet)
  log({
    module: 'CHG', page: '手术费用', action: 'CREATE',
    targetType: '费用单', targetId: sheet.chargeId, targetName: patientLabel(src.patientId),
    patientId: src.patientId, before: null,
    after: { 来源单号: src.chargeId, 明细条数: sheet.lines.length, 合计: fmtAmount(sheet.total) },
    reason: '基于已作废费用单 ' + src.chargeId + ' 重新录入'
  })
  persist()
  return sheet
}
