// 状态机拦截 + 前置校验 + 角色权限（5.3 / 5.9.3 / 4.2）
import { fmtTime } from './format'

const ENDED = ['WITHDRAWN', 'DISCHARGED']

/** 8 态患者状态机：只允许走白名单里的边（RULE-BAS-002） */
export const TRANSITIONS = {
  APPLIED: ['DAY_SURGERY'],
  DAY_SURGERY: ['SCHEDULED', 'WITHDRAWN', 'ADMITTED'],
  SCHEDULED: ['ADMITTED', 'DAY_SURGERY', 'WITHDRAWN'],
  ADMITTED: ['IN_SURGERY', 'SCHEDULED', 'TRANSFERRED', 'WITHDRAWN'],
  IN_SURGERY: ['ADMITTED', 'TRANSFERRED', 'DISCHARGED'],
  TRANSFERRED: ['ADMITTED'],
  DISCHARGED: [],
  WITHDRAWN: []
}

const ACTION_REQUIRED = {
  FREEZE: ['DAY_SURGERY'],
  SCHEDULE: ['DAY_SURGERY'],
  ADMIT: ['SCHEDULED', 'DAY_SURGERY'],
  CHECKIN: ['ADMITTED'],
  TRANSFER: ['ADMITTED', 'IN_SURGERY'],
  CHARGE: ['ADMITTED', 'IN_SURGERY'],
  ORDER: ['ADMITTED', 'IN_SURGERY'],
  WITHDRAW: ['DAY_SURGERY', 'SCHEDULED', 'ADMITTED']
}

const ACTION_TEXT = {
  FREEZE: '冻结储值金', SCHEDULE: '创建手术预约', ADMIT: '入院登记', CHECKIN: '手术报到',
  TRANSFER: '转普通住院', CHARGE: '录入手术费用', ORDER: '录入手术医嘱', WITHDRAW: '退出日间手术'
}

/** 业务动作前置校验：状态不符直接抛错，页面 catch 后提示 */
export function assertCanOperate(patient, action) {
  if (!patient) throw new Error('未找到该患者')
  if (ENDED.includes(patient.status)) {
    throw new Error('该患者已结束日间手术流程，不能再次操作')
  }
  const allowed = ACTION_REQUIRED[action]
  if (allowed && !allowed.includes(patient.status)) {
    throw new Error(`患者当前状态为「${labelOf(patient.status)}」，不能执行「${ACTION_TEXT[action]}」`)
  }
  return true
}

/** 状态流转白名单校验；同态视为幂等空操作 */
export function assertTransition(from, to) {
  if (from === to) return true
  const list = TRANSITIONS[from] || []
  if (!list.includes(to)) {
    throw new Error(`不允许的状态流转：${labelOf(from)} → ${labelOf(to)}`)
  }
  return true
}

/** 全站唯一患者状态写入口：改状态 + 追加状态轨迹（不删任何历史） */
export function goStatus(patient, to, extra = {}) {
  if (!patient) throw new Error('未找到该患者')
  assertTransition(patient.status, to)
  const from = patient.status
  if (!Array.isArray(patient.statusLogs)) patient.statusLogs = []
  if (from !== to) {
    patient.status = to
    patient.statusLogs.push({
      from,
      to,
      time: fmtTime(new Date()),
      by: extra.by || '',
      text: extra.text || `${labelOf(from)} → ${labelOf(to)}`
    })
  }
  return { from, to }
}

/** RULE-EVL-004：双评估通过且处于术前准备，才允许创建手术预约 */
export function canSchedule(patient) {
  if (!patient) return false
  return patient.status === 'DAY_SURGERY' &&
    patient.evalStatus?.specialist === 'PASSED' && patient.evalStatus?.anesthesia === 'PASSED'
}

/** 评估结论 → 标签文案（工作台与列表共用，避免各处写一套） */
export function evalSummary(patient) {
  const s = patient?.evalStatus?.specialist
  const a = patient?.evalStatus?.anesthesia
  if (s === 'FAILED' || a === 'FAILED') return { label: '评估不通过', type: 'danger' }
  if (s === 'PASSED' && a === 'PASSED') return { label: '评估通过', type: 'success' }
  if (s === 'PASSED') return { label: '专科已通过', type: 'success' }
  return { label: '待评估', type: 'info' }
}

export function labelOf(status) {
  return {
    APPLIED: '已申请', DAY_SURGERY: '术前准备', SCHEDULED: '已排程', ADMITTED: '已入院',
    IN_SURGERY: '术中', TRANSFERRED: '普通住院', DISCHARGED: '已出院', WITHDRAWN: '已退出'
  }[status] || status
}

/* ---------------- 角色权限（4.2：无权限一律隐藏，不置灰） ---------------- */
const PERMISSIONS = {
  ADMIN: ['workbench', 'apply', 'evaluate', 'schedule', 'deposit', 'admission', 'checkin',
    'charge', 'order', 'transfer', 'dict', 'message', 'log', 'trace', 'setting'],
  NURSE: ['workbench', 'apply', 'evaluate', 'schedule', 'deposit', 'admission', 'checkin',
    'charge', 'order', 'transfer', 'message', 'trace'],
  DOCTOR: ['workbench', 'evaluate', 'schedule', 'checkin', 'charge', 'order', 'transfer', 'trace'],
  CASHIER: ['workbench', 'deposit', 'charge', 'message', 'trace']
}

export function roleAllows(role, code) {
  const list = PERMISSIONS[role] || PERMISSIONS.NURSE
  if (!code) return true
  return list.includes(code)
}
