// OBJ-BAS-001 日间手术患者（3.2）
// 患者只能由申请单建档产生（FUNC-BAS-003），本模块不提供手工新建入口
import { state, persist } from './db'
import { log, queryByPatient } from './logs'
import { fmtTime } from '@/utils/format'
import { TODAY } from '@/mock/dict'

export function get(patientId) {
  return state.patients.find((p) => p.patientId === patientId) || null
}

export function listAll() {
  return state.patients
}

export function byInpatientNo(inpatientNo) {
  const no = String(inpatientNo || '').trim()
  return state.patients.find((p) => p.inpatientNo === no) || null
}

/** 患者 → 储值金账户（患者页与工作台都要用，放在这里避免双向依赖） */
export function accountOf(patientId) {
  return state.accounts.find((a) => a.patientId === patientId) || null
}

/** 当前有效排程：已预约 / 已变更 / 已报到（已取消与已完成不算） */
export function activeSchedule(patientId) {
  return state.schedules.find((s) =>
    s.patientId === patientId && ['SCHEDULED', 'CHANGED', 'CHECKED_IN'].includes(s.status)
  ) || null
}

/** 工作台四张统计卡 + 底部口径数据，全部实时计算，不落地存储 */
export function statCards() {
  const todayPlanned = state.schedules.filter((s) => s.surgeryDate === TODAY && s.status !== 'CANCELLED')
  const waitingSchedule = state.patients.filter((p) => p.status === 'DAY_SURGERY' && !activeSchedule(p.patientId))
  const waitingEval = state.patients.filter((p) => p.status === 'DAY_SURGERY' && (
    (p.evalStatus?.specialist || 'PENDING') === 'PENDING' ||
    (p.evalStatus?.anesthesia || 'PENDING') === 'PENDING'
  ))
  const waitingCheckin = state.patients.filter((p) => p.status === 'ADMITTED')
  return {
    todaySurgery: todayPlanned.length,
    waitingSchedule: waitingSchedule.length,
    waitingEval: waitingEval.length,
    waitingCheckin: waitingCheckin.length,
    daySurgery: state.patients.filter((p) => p.status === 'DAY_SURGERY').length,
    inSurgery: state.patients.filter((p) => p.status === 'IN_SURGERY').length,
    transferred: state.patients.filter((p) => p.status === 'TRANSFERRED').length,
    withdrawn: state.patients.filter((p) => p.status === 'WITHDRAWN').length,
    discharged: state.patients.filter((p) => p.status === 'DISCHARGED').length,
    total: state.patients.length
  }
}

/** 字段级修改（占位信息维护）：床号、责任护士、过敏史等，逐字段留痕 */
export function patchPatient(patientId, patch, reason = '') {
  const p = get(patientId)
  if (!p) throw new Error('未找到该患者')
  const before = {}
  Object.keys(patch).forEach((k) => { before[k] = p[k] })
  Object.assign(p, patch)
  p.updatedAt = fmtTime(new Date())
  p.updatedBy = state.session.name
  log({
    module: 'BAS', page: '工作台', action: 'UPDATE',
    targetType: '患者', targetId: p.inpatientNo, targetName: p.name + ' ' + p.inpatientNo,
    patientId, before, after: { ...patch }, reason
  })
  persist()
  return p
}

/** 患者操作轨迹：按发生时间正序返回该患者全部留痕（时间相同则按序号） */
export function trace(patientId) {
  return queryByPatient(patientId)
    .slice()
    .sort((a, b) => String(a.time).localeCompare(String(b.time)) || a.seq - b.seq)
}
