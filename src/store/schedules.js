// OBJ-SCH-001 手术预约排程单（3.16）
// ▲招标第 10 项的实现处：booked*（对患者的承诺）创建后永不修改，
// 安排字段（surgeryDate / room / seq / surgeon）可改，两者不一致即生成变动通知（RULE-SCH-003）
import dayjs from 'dayjs'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { push as pushMessage } from './messages'
import { goStatus, canSchedule, assertCan } from '@/utils/guard'
import { fmtDate, fmtTime } from '@/utils/format'
import { SURGERY_ROOMS, SURGERY_SEQS, ANESTHESIA_TYPES, CANCEL_REASONS } from '@/mock/dict'

export { SURGERY_ROOMS, SURGERY_SEQS, ANESTHESIA_TYPES, CANCEL_REASONS }

export const START_TIMES = ['08:30', '09:30', '10:30']
export const SURGEONS = ['张海涛', '李伟']

export const STATUS_MAP = {
  SCHEDULED: { label: '已预约', type: 'primary' },
  CHANGED: { label: '已变更', type: 'warning' },
  CHECKED_IN: { label: '已报到', type: 'success' },
  COMPLETED: { label: '已完成', type: 'info' },
  CANCELLED: { label: '已取消', type: 'info' }
}

/** 占用手术间台次的状态（已取消不占位） */
const OCCUPYING = ['SCHEDULED', 'CHANGED', 'CHECKED_IN', 'COMPLETED']
const ACTIVE = ['SCHEDULED', 'CHANGED', 'CHECKED_IN']

export function listAll() {
  return state.schedules
}

export function get(scheduleId) {
  return state.schedules.find((s) => s.scheduleId === scheduleId) || null
}

export function ofPatient(patientId) {
  return state.schedules.filter((s) => s.patientId === patientId)
}

/** 当前有效排程（已预约 / 已变更 / 已报到） */
export function activeSchedule(patientId) {
  return state.schedules.find((s) => s.patientId === patientId && ACTIVE.includes(s.status)) || null
}

/** 日视图：某个日期的手术（已取消不占台，但仍可在列表视图看到） */
export function byDate(date) {
  return state.schedules.filter((s) => s.surgeryDate === date && s.status !== 'CANCELLED')
}

/** 可排程患者：双评估通过 + 术前准备 + 尚无有效预约（RULE-EVL-004） */
export function scheduleable() {
  return state.patients.filter((p) => canSchedule(p) && !activeSchedule(p.patientId))
}

/* ---------------- RULE-SCH-001 台次冲突 ---------------- */
export function occupantOf(date, room, seq, excludeId) {
  return state.schedules.find((s) =>
    s.scheduleId !== excludeId &&
    OCCUPYING.includes(s.status) &&
    s.surgeryDate === date &&
    s.room === room &&
    Number(s.seq) === Number(seq)
  ) || null
}

export function isSlotFree(date, room, seq, excludeId) {
  return !occupantOf(date, room, seq, excludeId)
}

/** 冲突返回占用者（带患者姓名，页面直接提示），不冲突返回 null */
export function conflict(date, room, seq, excludeId) {
  const occ = occupantOf(date, room, seq, excludeId)
  if (!occ) return null
  const p = getPatient(occ.patientId)
  return {
    scheduleId: occ.scheduleId,
    patient: p ? p.name + '（' + p.inpatientNo + '）' : '其他患者',
    room: occ.room,
    seq: occ.seq
  }
}

/** RULE-SCH-002 冲突时给建议：同日其他手术间 → 同日其他台次 → 次日同间同台 */
export function suggest(date, room, seq) {
  const r0 = room || SURGERY_ROOMS[0]
  const s0 = Number(seq) || 1
  for (const r of SURGERY_ROOMS) {
    if (r === r0) continue
    if (isSlotFree(date, r, s0)) return { room: r, seq: s0 }
  }
  for (const s of SURGERY_SEQS) {
    if (s === s0) continue
    if (isSlotFree(date, r0, s)) return { room: r0, seq: s }
  }
  const next = dayjs(date).add(1, 'day').format('YYYY-MM-DD')
  if (isSlotFree(next, r0, s0)) return { room: r0, seq: s0 }
  return null
}

export function weekText(date) {
  return '周' + ['日', '一', '二', '三', '四', '五', '六'][dayjs(date).day()]
}

/** 预约（booked*）与实际安排是否不一致 */
export function isChanged(rec) {
  if (!rec) return false
  return rec.bookedDate !== rec.surgeryDate ||
    rec.bookedRoom !== rec.room ||
    Number(rec.bookedSeq) !== Number(rec.seq) ||
    rec.bookedSurgeon !== rec.surgeon
}

function nextScheduleId() {
  return 'SCH' + String(state.schedules.length + 1).padStart(8, '0')
}

function noticeDays() {
  return Number(state.settings.preAdmissionNoticeDays || 1)
}

function planTimeOf(date) {
  return dayjs(date).subtract(noticeDays(), 'day').hour(9).minute(0).second(0).format('YYYY-MM-DD HH:mm:ss')
}

/* ---------------- FUNC-SCH-001 创建手术预约 ---------------- */
export function create(form) {
  assertCan('sch.create', { module: 'SCH', page: '手术排程', action: 'CREATE', label: '创建手术预约', targetType: '手术排程' })
  const p = getPatient(form.patientId)
  if (!p) throw new Error('请选择患者')
  if (!canSchedule(p)) throw new Error('该患者评估未全部通过或状态不允许，不能创建手术预约')
  if (activeSchedule(p.patientId)) throw new Error('该患者已存在有效预约，请先取消原预约')
  if (!form.surgeryDate) throw new Error('请选择手术日期')
  if (!form.surgeon) throw new Error('请选择主刀医师')

  const room = form.room || SURGERY_ROOMS[0]
  const seq = Number(form.seq) || 1
  const occ = conflict(form.surgeryDate, room, seq)
  if (occ) throw new Error(room + ' ' + fmtDate(form.surgeryDate) + ' 第 ' + seq + ' 台已被' + occ.patient + '占用')

  const rec = {
    scheduleId: nextScheduleId(),
    patientId: p.patientId,
    surgeryDate: form.surgeryDate,
    room,
    seq,
    surgeon: form.surgeon,
    anesthesiologist: form.anesthesiologist || '',
    anesthesiaType: form.anesthesiaType || '',
    status: 'SCHEDULED',
    bookedDate: form.surgeryDate,
    bookedRoom: room,
    bookedSeq: seq,
    bookedSurgeon: form.surgeon,
    isChanged: false,
    changeCount: 0,
    changeLogs: [],
    cancelReason: '',
    createdAt: fmtTime(new Date()),
    createdBy: state.session.name
  }
  state.schedules.push(rec)

  const before = { 患者状态: '术前准备' }
  goStatus(p, 'SCHEDULED', { by: state.session.name, text: '创建手术预约：术前准备 → 已排程' })
  p.scheduleId = rec.scheduleId
  p.plannedSurgeryDate = rec.surgeryDate
  p.surgeryRoom = rec.room
  p.surgeon = rec.surgeon

  // 下游触发：预约成功短信 + 入院前提醒（招标第 6、7 项）
  const auto = state.settings.autoSendAppointmentSms !== false
  pushMessage({
    patientId: p.patientId,
    type: 'APPOINTMENT_SUCCESS',
    tplKey: 'APPOINTMENT_SUCCESS',
    channel: '短信',
    status: auto ? 'SENT' : 'PENDING',
    planSendTime: fmtTime(new Date()),
    trigger: '创建手术预约 ' + rec.scheduleId,
    vars: {
      手术日期: fmtDate(rec.surgeryDate), 星期: weekText(rec.surgeryDate),
      手术间: rec.room, 台次: rec.seq, 主刀: rec.surgeon,
      麻醉方式: rec.anesthesiaType, 科室: p.dept, 住院号: p.inpatientNo,
      禁食提示: state.settings.fastingTip || '术前 8 小时禁食、4 小时禁饮。'
    }
  })
  pushMessage({
    patientId: p.patientId,
    type: 'PRE_ADMISSION',
    tplKey: 'PRE_ADMISSION',
    channel: '短信',
    status: 'PENDING',
    planSendTime: planTimeOf(rec.surgeryDate),
    trigger: '入院前提醒（提前 ' + noticeDays() + ' 天）',
    vars: {
      手术日期: fmtDate(rec.surgeryDate), 星期: weekText(rec.surgeryDate),
      手术间: rec.room, 台次: rec.seq, 主刀: rec.surgeon,
      麻醉方式: rec.anesthesiaType, 科室: p.dept, 住院号: p.inpatientNo,
      禁食提示: state.settings.fastingTip || '术前 8 小时禁食、4 小时禁饮。'
    }
  })

  log({
    module: 'SCH', page: '手术排程', action: 'CREATE',
    targetType: '手术预约', targetId: rec.scheduleId, targetName: p.name + ' ' + p.inpatientNo,
    patientId: p.patientId, before,
    after: {
      手术日期: fmtDate(rec.surgeryDate), 手术间: rec.room,
      台次: '第 ' + rec.seq + ' 台', 主刀医师: rec.surgeon, 麻醉方式: rec.anesthesiaType
    },
    reason: '创建手术预约（预约成功短信与入院前提醒已生成）'
  })
  persist()
  return rec
}

/* ---------------- FUNC-SCH-003 调整手术安排 ▲招标第 10 项 ---------------- */
export function adjust(scheduleId, form, reason, channel) {
  assertCan('sch.adjust', { module: 'SCH', page: '手术排程', action: 'UPDATE', label: '调整手术安排', targetType: '手术排程' })
  const rec = get(scheduleId)
  if (!rec) throw new Error('未找到该排程记录')
  if (!['SCHEDULED', 'CHANGED'].includes(rec.status)) throw new Error('该排程状态不允许调整安排')
  if (!reason) throw new Error('请选择变更原因')

  const p = getPatient(rec.patientId)
  const date = form.surgeryDate || rec.surgeryDate
  const room = form.room || rec.room
  const seq = Number(form.seq) || rec.seq
  const surgeon = form.surgeon || rec.surgeon

  const occ = conflict(date, room, seq, rec.scheduleId)
  if (occ) throw new Error(room + ' ' + fmtDate(date) + ' 第 ' + seq + ' 台已被' + occ.patient + '占用')

  const before = {
    手术日期: fmtDate(rec.surgeryDate), 手术间: rec.room,
    台次: '第 ' + rec.seq + ' 台', 主刀医师: rec.surgeon
  }
  rec.surgeryDate = date
  rec.room = room
  rec.seq = seq
  rec.surgeon = surgeon
  if (form.anesthesiaType) rec.anesthesiaType = form.anesthesiaType

  const changed = isChanged(rec)
  if (changed) {
    rec.isChanged = true
    rec.status = 'CHANGED'
    rec.changeCount = (rec.changeCount || 0) + 1
    rec.changeLogs = rec.changeLogs || []
    rec.changeLogs.push({
      time: fmtTime(new Date()),
      operator: state.session.name,
      reason,
      text: `${fmtDate(rec.bookedDate)} ${rec.bookedRoom} 第 ${rec.bookedSeq} 台 → ${fmtDate(rec.surgeryDate)} ${rec.room} 第 ${rec.seq} 台`
    })
    if (p) p.plannedSurgeryDate = rec.surgeryDate

    pushMessage({
      patientId: rec.patientId,
      type: 'SCHEDULE_CHANGE',
      tplKey: 'SCHEDULE_CHANGE',
      channel: channel || state.settings.changeNoticeChannel || 'BOTH',
      status: 'SENT',
      planSendTime: fmtTime(new Date()),
      trigger: '调整手术安排 ' + rec.scheduleId,
      vars: {
        患者姓名: p ? p.name : '',
        原日期: fmtDate(rec.bookedDate), 原手术间: rec.bookedRoom, 原台次: rec.bookedSeq,
        手术日期: fmtDate(rec.surgeryDate), 星期: weekText(rec.surgeryDate),
        手术间: rec.room, 台次: rec.seq, 主刀: rec.surgeon,
        麻醉方式: rec.anesthesiaType, 科室: p ? p.dept : '',
        禁食提示: state.settings.fastingTip || '术前 8 小时禁食、4 小时禁饮。'
      }
    })
    // 未发送的入院前提醒按新日期重算（RULE-MSG-001）
    state.messages
      .filter((m) => m.patientId === rec.patientId && m.type === 'PRE_ADMISSION' && m.status === 'PENDING')
      .forEach((m) => { m.planSendTime = planTimeOf(rec.surgeryDate) })
  }

  log({
    module: 'SCH', page: '手术排程', action: 'UPDATE',
    targetType: '手术排程', targetId: rec.scheduleId, targetName: p ? p.name + ' ' + p.inpatientNo : rec.patientId,
    patientId: rec.patientId, before,
    after: {
      手术日期: fmtDate(rec.surgeryDate), 手术间: rec.room,
      台次: '第 ' + rec.seq + ' 台', 主刀医师: rec.surgeon,
      预约信息: changed ? '与实际安排不一致' : '一致'
    },
    reason
  })
  persist()
  return rec
}

/* ---------------- FUNC-SCH-004 取消预约 ---------------- */
export function cancel(scheduleId, reason) {
  assertCan('sch.cancel', { module: 'SCH', page: '手术排程', action: 'CANCEL', label: '取消手术预约', targetType: '手术排程' })
  const rec = get(scheduleId)
  if (!rec) throw new Error('未找到该排程记录')
  if (rec.status === 'CANCELLED') throw new Error('该预约已取消，不能重复取消')
  if (rec.status === 'CHECKED_IN') throw new Error('该患者已报到，不能取消预约')
  if (!reason) throw new Error('请选择取消原因')

  const before = { 排程状态: STATUS_MAP[rec.status]?.label || rec.status }
  rec.status = 'CANCELLED'
  rec.cancelReason = reason

  const p = getPatient(rec.patientId)
  if (p) {
    p.scheduleId = ''
    if (p.status === 'SCHEDULED') {
      goStatus(p, 'DAY_SURGERY', { by: state.session.name, text: '取消预约：已排程 → 术前准备' })
    }
    pushMessage({
      patientId: p.patientId,
      type: 'CANCEL',
      channel: '短信',
      status: 'SENT',
      planSendTime: fmtTime(new Date()),
      trigger: '取消手术预约 ' + rec.scheduleId,
      content: '【日间手术中心】' + p.name + '您好，您的手术预约已取消。原因：' + reason +
        '。如需重新预约请与日间手术中心联系，电话 028-8888 6120。'
    })
  }
  // 未发送的入院前提醒置为已作废
  state.messages
    .filter((m) => m.patientId === rec.patientId && m.type === 'PRE_ADMISSION' && m.status === 'PENDING')
    .forEach((m) => { m.status = 'VOIDED' })

  log({
    module: 'SCH', page: '手术排程', action: 'CANCEL',
    targetType: '手术预约', targetId: rec.scheduleId, targetName: p ? p.name + ' ' + p.inpatientNo : rec.patientId,
    patientId: rec.patientId, before, after: { 排程状态: '已取消', 取消原因: reason },
    reason
  })
  persist()
  return rec
}
