// OBJ-ORD-001 手术医嘱（3.10）
// ▲招标第 13 项：补录手术医嘱，至少包含手术过程中使用到的麻醉药
// isAnesthetic 由药品字典推导（RULE-ORD-002），页面不填写
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { fmtTime, round2 } from '@/utils/format'

export const ORDER_STATUS = ['待提交', '未执行', '执行中', '已执行', '已停止', '已作废']

export function listOf(patientId) {
  return state.orders.filter((o) => o.patientId === patientId)
}

/** 待提交医嘱：录入后先落到待提交状态，确认无误再一次性提交 */
export function pendingOf(patientId) {
  return listOf(patientId).filter((o) => o.execStatus === '待提交' && !o.removed)
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

/* ---------------- FUNC-ORD-001 录入手术医嘱 ----------------
 * 新录医嘱一律进入「待提交」状态，可在操作栏移除；确认无误后一次性提交
 * 支持口头医嘱：医师口述、护士复述，复述人与复述时间一并留痕
 */
export function add(patientId, form = {}) {
  assertCan('ord.add', { module: 'ORD', page: '手术医嘱', action: 'CREATE', label: '录入手术医嘱', targetType: '医嘱' })
  const drug = state.dicts.drugs.find((d) => d.code === form.drugCode)
  if (!drug) throw new Error('请选择药品')
  if (!drug.enabled) throw new Error('该药品规格已停用，不能开立医嘱')
  const dose = Number(form.dose)
  if (!(dose > 0)) throw new Error('剂量必须大于 0')
  if (!form.usage) throw new Error('请选择用法')
  if (!form.freq) throw new Error('请选择频次')
  if (!form.startTime) throw new Error('请选择开始时间')
  const isVerbal = !!form.isVerbal
  if (isVerbal && !String(form.reciter || '').trim()) throw new Error('口头医嘱必须填写复述人')
  if (isVerbal && !form.reciteTime) throw new Error('口头医嘱必须填写复述时间')
  // 单位默认随规格联动，医师可手工改；提交时以填写值为准
  const unit = String(form.unit || drug.unit || '').trim()
  if (!unit) throw new Error('请选择剂量单位')

  const order = {
    orderId: nextOrderId(),
    patientId,
    type: form.type === '长期' ? '长期' : '临时',
    drugCode: drug.code,
    drugName: drug.name,
    spec: drug.spec,
    dose: round2(dose),
    unit,
    usage: form.usage,
    freq: form.freq,
    startTime: form.startTime,
    remark: (form.remark || '').trim(),
    doctor: state.session.name,
    isAnesthetic: !!drug.isAnesthetic,
    isVerbal,
    reciter: isVerbal ? String(form.reciter || '').trim() : '',
    reciteTime: isVerbal ? form.reciteTime : '',
    verbalNote: isVerbal ? (form.verbalNote || '').trim() : '',
    execStatus: '待提交',
    submittedAt: '',
    submittedBy: '',
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
      药品: order.drugName, 规格: order.spec, 剂量: order.dose + order.unit, 用法: order.usage,
      频次: order.freq, 麻醉药: order.isAnesthetic ? '是' : '否',
      医嘱类型: isVerbal ? '口头医嘱' : '书面医嘱', 执行状态: '待提交',
      ...(isVerbal ? { 复述人: order.reciter } : {}),
      ...(order.remark ? { 备注: order.remark } : {})
    },
    reason: isVerbal ? '录入口头医嘱（待提交）' : '录入手术医嘱（待提交）'
  })
  persist()
  return order
}

/* ---------------- FUNC-ORD-002 一次性提交待提交医嘱 ----------------
 * 记录确认无误后点击提交，一次性把该患者全部待提交医嘱提交下去
 */
export function submitPending(patientId) {
  assertCan('ord.submit', { module: 'ORD', page: '手术医嘱', action: 'STATUS', label: '提交手术医嘱', targetType: '医嘱' })
  const list = pendingOf(patientId)
  if (!list.length) throw new Error('没有待提交的医嘱')
  const at = fmtTime(new Date())
  const before = { 待提交医嘱数: String(list.length), 执行状态: '待提交' }
  list.forEach((o) => {
    o.execStatus = o.type === '长期' ? '执行中' : '未执行'
    o.submittedAt = at
    o.submittedBy = state.session.name
  })
  log({
    module: 'ORD', page: '手术医嘱', action: 'STATUS',
    targetType: '医嘱', targetId: list.map((o) => o.orderId).join('、'),
    targetName: `${patientLabel(patientId)} ${list.length} 条医嘱`, patientId, before,
    after: { 提交医嘱数: String(list.length), 提交时间: at, 执行状态: '已提交' },
    reason: '记录确认无误，一次性提交手术医嘱'
  })
  persist()
  return list
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

  const before = { 药品: o.drugName, 规格: o.spec, 剂量: o.dose + o.unit, 用法: o.usage, 频次: o.freq, ...(o.remark ? { 备注: o.remark } : {}) }
  // 换规格：按字典里的具体规格记录，同名不同规格＝不同编码
  if (body.drugCode !== undefined && body.drugCode !== o.drugCode) {
    const nd = state.dicts.drugs.find((d) => d.code === body.drugCode)
    if (!nd) throw new Error('未找到该药品规格')
    if (!nd.enabled) throw new Error('该药品规格已停用，不能选用')
    o.drugCode = nd.code
    o.drugName = nd.name
    o.spec = nd.spec
    o.isAnesthetic = !!nd.isAnesthetic
    if (body.unit === undefined) o.unit = nd.unit
  }
  if (body.unit !== undefined) {
    const u = String(body.unit).trim()
    if (!u) throw new Error('请选择剂量单位')
    o.unit = u
  }
  if (body.dose !== undefined) o.dose = round2(Number(body.dose))
  if (body.usage !== undefined) o.usage = body.usage
  if (body.freq !== undefined) o.freq = body.freq
  if (body.remark !== undefined) o.remark = String(body.remark).trim()
  log({
    module: 'ORD', page: '手术医嘱', action: 'UPDATE',
    targetType: '医嘱', targetId: o.orderId, targetName: o.drugName + ' ' + o.dose + o.unit,
    patientId: o.patientId, before,
    after: { 药品: o.drugName, 规格: o.spec, 剂量: o.dose + o.unit, 用法: o.usage, 频次: o.freq, ...(o.remark ? { 备注: o.remark } : {}) },
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
  if (o.execStatus === '待提交') throw new Error('待提交医嘱尚未执行，直接移除即可')
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
  if (o.execStatus === '待提交') throw new Error('待提交医嘱尚未执行，直接移除即可')
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
