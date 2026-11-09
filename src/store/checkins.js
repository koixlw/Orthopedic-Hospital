// OBJ-CIR-001 手术报到记录（3.17）
// ▲招标第 11 项：报到前四项前置校验，逐条返回，页面逐条渲染（RULE-CIR-001）
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { accountOf } from './accounts'
import { activeSchedule } from './schedules'
import { goStatus, assertCan } from '@/utils/guard'
import { fmtAmount, fmtDate, fmtTime } from '@/utils/format'
import { TODAY } from '@/mock/dict'

// ▲招标第 11 项：扫申请单条码 / 刷医保卡 / 刷就诊卡 / 刷身份证 / 手工输入病历号·申请单号
export const CHECKIN_METHODS = {
  SCAN: '扫申请单条码',
  MEDICAL_CARD: '刷医保卡',
  VISIT_CARD: '刷就诊卡',
  ID_CARD: '刷身份证',
  MANUAL: '手工输入住院号'
}

export function listOf(patientId) {
  return state.checkins.filter((c) => c.patientId === patientId)
}

/** 今日待报到的手术（已预约 / 已变更） */
export function todaySchedules() {
  return state.schedules.filter((s) =>
    s.surgeryDate === TODAY && ['SCHEDULED', 'CHANGED'].includes(s.status))
}

/**
 * RULE-CIR-001 四项前置校验：逐条返回，任一项不过即禁用报到
 * @returns [{ key, ok, label, detail, linkText, link }]
 */
export function preCheck(patientId) {
  const p = getPatient(patientId)
  const sch = p ? activeSchedule(p.patientId) : null
  const out = []

  // ① 有有效手术预约
  out.push({
    key: 'schedule',
    ok: !!sch,
    label: '手术预约',
    detail: sch
      ? '已预约 ' + fmtDate(sch.surgeryDate) + ' ' + sch.room + ' 第 ' + sch.seq + ' 台'
      : '该患者无有效手术预约，不能报到',
    linkText: '去创建预约',
    link: '/schedule?patient=' + patientId
  })

  // ② 手术日期 = 今日
  const sameDay = !!sch && sch.surgeryDate === TODAY
  out.push({
    key: 'date',
    ok: sameDay,
    label: '手术日期',
    detail: sameDay
      ? '手术日期为今日'
      : (sch ? '手术日期为 ' + fmtDate(sch.surgeryDate) + '，不能提前或延后报到' : '无预约，无法判断报到日期'),
    linkText: '去调整安排',
    link: '/schedule?patient=' + patientId
  })

  // ③ 专科与麻醉评估均通过
  const passed = p?.evalStatus?.specialist === 'PASSED' && p?.evalStatus?.anesthesia === 'PASSED'
  out.push({
    key: 'eval',
    ok: passed,
    label: '术前评估',
    detail: passed ? '专科与麻醉评估均通过' : '评估未全部通过，不能报到',
    linkText: '查看评估',
    link: '/evaluation/' + patientId
  })

  // ④ 储值金已冻结，或已转入住院储值金
  const acc = accountOf(patientId)
  const ready = !!acc && (Number(acc.frozen) > 0 || acc.status === 'TRANSFERRED_IN')
  out.push({
    key: 'deposit',
    ok: ready,
    label: '储值金',
    detail: ready
      ? (Number(acc.frozen) > 0
        ? '储值金已冻结 ¥' + fmtAmount(acc.frozen)
        : '储值金已转入住院 ¥' + fmtAmount(acc.inpatientDeposit))
      : '储值金未冻结且未转入住院，不能报到',
    linkText: '去储值金管理',
    link: '/deposit/' + patientId
  })

  return out
}

export function canCheckIn(patientId) {
  return preCheck(patientId).every((c) => c.ok)
}

/** FUNC-CIR-001 报到登记：校验快照入库 + 状态流转 + 排程置为已报到 */
export function doCheckIn(patientId, method = CHECKIN_METHODS.MANUAL) {
  assertCan('chk.confirm', { module: 'CIR', page: '手术报到', action: 'CREATE', label: '确认手术报到', targetType: '报到记录' })
  const p = getPatient(patientId)
  if (!p) throw new Error('未找到该患者')
  if (!Object.values(CHECKIN_METHODS).includes(method)) throw new Error('报到方式无效，请重新选择报到方式')
  if (p.status === 'IN_SURGERY') throw new Error('该患者已完成报到，不能重复报到')
  const checks = preCheck(patientId)
  const bad = checks.filter((c) => !c.ok)
  if (bad.length) throw new Error('报到条件不满足：' + bad[0].label + ' —— ' + bad[0].detail)

  const sch = activeSchedule(patientId)
  const rec = {
    checkInId: 'CIR' + String(state.checkins.length + 1).padStart(6, '0'),
    patientId,
    scheduleId: sch ? sch.scheduleId : '',
    checkInTime: fmtTime(new Date()),
    checkInMethod: method,
    checkInBy: state.session.name,
    guardsSnapshot: checks.map((c) => ({ key: c.key, label: c.label, ok: c.ok, detail: c.detail })),
    printConsent: false,
    printTime: '',
    voided: false,
    voidReason: ''
  }
  state.checkins.push(rec)

  const before = { 患者状态: '已入院' }
  goStatus(p, 'IN_SURGERY', { by: state.session.name, text: '报到登记：已入院 → 术中' })
  p.checkInStatus = 'CHECKED_IN'
  if (sch) sch.status = 'CHECKED_IN'

  log({
    module: 'CIR', page: '手术报到', action: 'STATUS',
    targetType: '报到记录', targetId: rec.checkInId, targetName: p.name + ' ' + p.inpatientNo,
    patientId, before,
    after: { 患者状态: '术中', 报到方式: method, 四项校验: '全部通过' },
    reason: '报到登记'
  })
  persist()
  return rec
}

/** FUNC-CIR-002 取消报到：记录软作废，状态回退，排程回到已预约/已变更 */
export function cancelCheckIn(patientId, reason) {
  assertCan('chk.cancel', { module: 'CIR', page: '手术报到', action: 'CANCEL', label: '取消报到', targetType: '报到记录' })
  if (!reason) throw new Error('请填写取消原因')
  const p = getPatient(patientId)
  if (!p) throw new Error('未找到该患者')
  const rec = state.checkins
    .filter((c) => c.patientId === patientId && !c.voided)
    .slice()
    .pop()
  if (!rec) throw new Error('该患者没有可取消的报到记录')

  const before = { 患者状态: '术中', 报到记录: rec.checkInId }
  rec.voided = true
  rec.voidReason = reason
  p.checkInStatus = 'NOT_CHECKED_IN'
  if (p.status === 'IN_SURGERY') {
    goStatus(p, 'ADMITTED', { by: state.session.name, text: '取消报到：术中 → 已入院' })
  }
  const sch = state.schedules.find((s) => s.scheduleId === rec.scheduleId)
  if (sch) sch.status = sch.isChanged ? 'CHANGED' : 'SCHEDULED'

  log({
    module: 'CIR', page: '手术报到', action: 'CANCEL',
    targetType: '报到记录', targetId: rec.checkInId, targetName: p.name + ' ' + p.inpatientNo,
    patientId, before, after: { 患者状态: '已入院', 报到记录: '已作废' },
    reason
  })
  persist()
  return rec
}

/** FUNC-CIR-003 打印手术知情同意书（假打印，写 EXPORT 日志） */
export function printConsent(patientId) {
  assertCan('chk.print', { module: 'CIR', page: '手术报到', action: 'EXPORT', label: '打印知情同意书', targetType: '知情同意书' })
  const p = getPatient(patientId)
  const rec = state.checkins.filter((c) => c.patientId === patientId && !c.voided).slice().pop()
  if (rec) {
    rec.printConsent = true
    rec.printTime = fmtTime(new Date())
  }
  log({
    module: 'CIR', page: '手术报到', action: 'EXPORT',
    targetType: '知情同意书', targetId: rec ? rec.checkInId : '',
    targetName: p ? p.name + ' ' + p.inpatientNo : patientId,
    patientId, before: null,
    after: { 文书: '手术知情同意书', 打印状态: '已发送至打印队列' },
    reason: '打印手术知情同意书'
  })
  persist()
  return true
}
