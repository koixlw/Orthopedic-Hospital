// OBJ-ORD-001 手术医嘱（3.10）
// ▲招标第 13 项：补录手术医嘱，至少包含手术过程中使用到的麻醉药
// isAnesthetic 由药品字典推导（RULE-ORD-002），页面不填写
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { fmtTime, round2 } from '@/utils/format'

export const ORDER_STATUS = ['未执行', '执行中', '已执行', '已停止', '已作废']

export function listOf(patientId) {
  return state.orders.filter((o) => o.patientId === patientId)
}

export function get(orderId) {
  return state.orders.find((o) => o.orderId === orderId) || null
}

function patientLabel(patientId) {
  const p = getPatient(patientId)
  return p ? p.name + ' ' + p.inpatientNo : patientId
}

function nextOrderId() {
  return 'ORD' + String(state.orders.length + 1).padStart(4, '0')
}

/* ---------------- FUNC-ORD-001 录入手术医嘱 ---------------- */
export function add(patientId, form = {}) {
  assertCan('ord.add', { module: 'ORD', page: '手术医嘱', action: 'CREATE', label: '录入手术医嘱', targetType: '医嘱' })
  const drug = state.dicts.drugs.find((d) => d.code === form.drugCode)
  if (!drug) throw new Error('请选择药品')
  if (!drug.enabled) throw new Error('该药品已停用，不能开立医嘱')
  const dose = Number(form.dose)
  if (!(dose > 0)) throw new Error('剂量必须大于 0')
  if (!form.usage) throw new Error('请选择用法')
  if (!form.freq) throw new Error('请选择频次')
  if (!form.startTime) throw new Error('请选择开始时间')

  const order = {
    orderId: nextOrderId(),
    patientId,
    type: form.type === '长期' ? '长期' : '临时',
    drugCode: drug.code,
    drugName: drug.name,
    spec: drug.spec,
    dose: round2(dose),
    unit: drug.unit,
    usage: form.usage,
    freq: form.freq,
    startTime: form.startTime,
    doctor: state.session.name,
    isAnesthetic: !!drug.isAnesthetic,
    execStatus: form.type === '长期' ? '执行中' : '未执行',
    stopTime: '',
    voidReason: '',
    removed: false,
    removeReason: '',
    removedBy: '',
    removedAt: ''
  }
  state.orders.push(order)
  log({
    module: 'ORD', page: '手术医嘱', action: 'CREATE',
    targetType: '医嘱', targetId: order.orderId, targetName: order.drugName + ' ' + order.dose + order.unit,
    patientId, before: null,
    after: {
      药品: order.drugName, 剂量: order.dose + order.unit, 用法: order.usage,
      频次: order.freq, 麻醉药: order.isAnesthetic ? '是' : '否'
    },
    reason: '录入手术医嘱'
  })
  persist()
  return order
}

/* ---------------- FUNC-ORD-003 修改医嘱 ---------------- */
export function patch(orderId, body = {}, reason = '') {
  assertCan('ord.add', { module: 'ORD', page: '手术医嘱', action: 'UPDATE', label: '修改医嘱', targetType: '医嘱' })
  const o = get(orderId)
  if (!o) throw new Error('未找到该医嘱')
  if (o.removed) throw new Error('已移除的医嘱不能修改，请先恢复')
  if (o.execStatus === '已执行') throw new Error('已执行医嘱只能作废，不能修改')
  if (o.execStatus === '已停止') throw new Error('已停嘱的医嘱不能修改')
  if (o.execStatus === '已作废') throw new Error('已作废的医嘱不能修改')
  if (body.dose !== undefined && !(Number(body.dose) > 0)) throw new Error('剂量必须大于 0')

  const before = { 剂量: o.dose + o.unit, 用法: o.usage, 频次: o.freq }
  if (body.dose !== undefined) o.dose = round2(Number(body.dose))
  if (body.usage !== undefined) o.usage = body.usage
  if (body.freq !== undefined) o.freq = body.freq
  log({
    module: 'ORD', page: '手术医嘱', action: 'UPDATE',
    targetType: '医嘱', targetId: o.orderId, targetName: o.drugName + ' ' + o.dose + o.unit,
    patientId: o.patientId, before,
    after: { 剂量: o.dose + o.unit, 用法: o.usage, 频次: o.freq },
    reason: reason || '修改手术医嘱'
  })
  persist()
  return o
}

/* ---------------- FUNC-ORD-004 移除医嘱（软删可恢复） ---------------- */
export function remove(orderId, reason = '') {
  assertCan('ord.remove', { module: 'ORD', page: '手术医嘱', action: 'REMOVE', label: '移除医嘱', targetType: '医嘱' })
  const o = get(orderId)
  if (!o) throw new Error('未找到该医嘱')
  if (o.removed) throw new Error('该医嘱已移除，不能重复移除')
  if (o.execStatus === '已执行') throw new Error('已执行医嘱只能作废，不能移除')
  const before = { 药品: o.drugName, 剂量: o.dose + o.unit, 状态: '正常' }
  o.removed = true
  o.removeReason = reason
  o.removedBy = state.session.name
  o.removedAt = fmtTime(new Date())
  log({
    module: 'ORD', page: '手术医嘱', action: 'REMOVE',
    targetType: '医嘱', targetId: o.orderId, targetName: o.drugName + ' ' + o.dose + o.unit,
    patientId: o.patientId, before, after: { 状态: '已移除（可恢复）' },
    reason
  })
  persist()
  return o
}

export function restore(orderId) {
  assertCan('ord.add', { module: 'ORD', page: '手术医嘱', action: 'UPDATE', label: '恢复医嘱', targetType: '医嘱' })
  const o = get(orderId)
  if (!o) throw new Error('未找到该医嘱')
  if (!o.removed) throw new Error('该医嘱未被移除，无需恢复')
  const before = { 状态: '已移除' }
  o.removed = false
  o.removeReason = ''
  o.removedBy = ''
  o.removedAt = ''
  log({
    module: 'ORD', page: '手术医嘱', action: 'UPDATE',
    targetType: '医嘱', targetId: o.orderId, targetName: o.drugName + ' ' + o.dose + o.unit,
    patientId: o.patientId, before, after: { 状态: '正常' },
    reason: '恢复被移除的医嘱'
  })
  persist()
  return o
}

/* ---------------- FUNC-ORD-005 停止长期医嘱 ---------------- */
export function stop(orderId, reason) {
  assertCan('ord.stop', { module: 'ORD', page: '手术医嘱', action: 'UPDATE', label: '停止医嘱', targetType: '医嘱' })
  const o = get(orderId)
  if (!o) throw new Error('未找到该医嘱')
  if (o.type !== '长期') throw new Error('只有长期医嘱可以停嘱')
  if (o.execStatus === '已停止') throw new Error('该医嘱已停嘱，不能重复停嘱')
  if (o.execStatus === '已执行') throw new Error('已执行医嘱只能作废，不能停嘱')
  if (!reason) throw new Error('请填写停止原因')
  const before = { 执行状态: o.execStatus }
  o.execStatus = '已停止'
  o.stopTime = fmtTime(new Date())
  log({
    module: 'ORD', page: '手术医嘱', action: 'STATUS',
    targetType: '医嘱', targetId: o.orderId, targetName: o.drugName + ' ' + o.dose + o.unit,
    patientId: o.patientId, before,
    after: { 执行状态: '已停止', 停止时间: o.stopTime },
    reason
  })
  persist()
  return o
}

/** 已执行医嘱只能作废（保留记录，不删） */
export function voidOrder(orderId, reason) {
  assertCan('ord.void', { module: 'ORD', page: '手术医嘱', action: 'VOID', label: '作废医嘱', targetType: '医嘱' })
  const o = get(orderId)
  if (!o) throw new Error('未找到该医嘱')
  if (o.execStatus === '已作废') throw new Error('该医嘱已作废，不能重复作废')
  if (!reason) throw new Error('请选择作废原因')
  const before = { 执行状态: o.execStatus }
  o.execStatus = '已作废'
  o.voidReason = reason
  log({
    module: 'ORD', page: '手术医嘱', action: 'VOID',
    targetType: '医嘱', targetId: o.orderId, targetName: o.drugName + ' ' + o.dose + o.unit,
    patientId: o.patientId, before, after: { 执行状态: '已作废', 作废原因: reason },
    reason
  })
  persist()
  return o
}
