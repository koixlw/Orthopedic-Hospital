// OBJ-MSG-001 消息通知（3.18）
// 通知只能由业务动作自动生成，页面不得手写（RULE-MSG-001 / 禁令 19）
import { computed } from 'vue'
import { state, persist } from './db'
import { log } from './logs'
import { assertCan } from '@/utils/guard'
import { get as getPatient } from './patients'
import { fmtTime } from '@/utils/format'
import { render as renderTpl } from './templates'

export const TYPE_MAP = {
  APPOINTMENT_SUCCESS: { label: '预约成功', type: 'primary' },
  PRE_ADMISSION: { label: '入院前提醒', type: 'success' },
  SCHEDULE_CHANGE: { label: '安排变动', type: 'warning' },
  CANCEL: { label: '取消通知', type: 'info' }
}

export const STATUS_MAP = {
  PENDING: { label: '待发送', type: 'warning' },
  SENT: { label: '已发送', type: 'success' },
  FAILED: { label: '发送失败', type: 'danger' },
  VOIDED: { label: '已作废', type: 'info' }
}

export const CHANNELS = ['短信', '电话', '短信 + 电话']

export const all = computed(() => state.messages)

export function listAll() {
  return state.messages
}

export function get(msgId) {
  return state.messages.find((m) => m.msgId === msgId) || null
}

/** 唯一写入口：只能被业务动作调用（建档、预约、调整、取消、参数保存） */
export function push({
  patientId, type, channel = '短信', content = '',
  planSendTime, status = 'PENDING', trigger = '', failReason = '',
  tplKey = '', vars = {}
}) {
  const p = getPatient(patientId)
  const phone = p ? p.phone : ''
  const hasPhone = !!phone && !/^\*+$/.test(phone.replace(/[\d*]/g, ''))
  const finalStatus = phone ? status : 'FAILED'
  // FUNC-MSG-003：正文优先取模板渲染结果；未传 content 时按 type/tplKey 套模板
  const text = content || renderTpl(tplKey || type, { 患者姓名: p ? p.name : '', ...vars })
  const tpl = (tplKey || type)

  const msg = {
    msgId: 'MSG' + String(state.messages.length + 1).padStart(3, '0'),
    patientId,
    type,
    channel,
    phone,
    status: finalStatus,
    planSendTime: planSendTime || fmtTime(new Date()),
    sendTime: finalStatus === 'SENT' ? fmtTime(new Date()) : '',
    resendCount: 0,
    trigger,
    tplKey: tpl,
    smsCount: Math.max(1, Math.ceil((text || '').length / 70)),
    content: text,
    failReason: finalStatus === 'FAILED' ? (failReason || (hasPhone ? '网关返回：号码状态异常' : '接收号码为空')) : ''
  }
  state.messages.push(msg)
  persist()
  return msg
}

/** FUNC-MSG-002 重发通知：只有发送失败可重发，重发也留痕 */
export function resend(msgId) {
  const msg = get(msgId)
  if (!msg) throw new Error('未找到该通知')
  if (msg.status !== 'FAILED') throw new Error('只有发送失败的通知可以重发')
  const before = { 通知状态: STATUS_MAP[msg.status]?.label || msg.status, 失败原因: msg.failReason }
  msg.status = 'SENT'
  msg.failReason = ''
  msg.sendTime = fmtTime(new Date())
  msg.resendCount = (msg.resendCount || 0) + 1

  const p = getPatient(msg.patientId)
  log({
    module: 'MSG', page: '消息通知', action: 'UPDATE',
    targetType: '通知', targetId: msg.msgId, targetName: p ? p.name + ' ' + p.inpatientNo : msg.patientId,
    patientId: msg.patientId, before,
    after: { 通知状态: '已发送', 重发次数: msg.resendCount },
    reason: '通知重发'
  })
  persist()
  return msg
}

/** 到点未发送的提醒（入院前通知用） */
export function dueList(type) {
  const now = fmtTime(new Date())
  return state.messages.filter((m) => m.type === type && m.status === 'PENDING' && (m.planSendTime || '') <= now)
}

/** FUNC-MSG-003 执行通知任务：把已到发送时间的待发短信置为已发送（真实系统由定时任务触发） */
export function runDue(type) {
  assertCan('msg.send', {
    module: 'MSG', page: '消息通知', action: 'UPDATE',
    label: '执行通知发送任务', targetType: '通知任务', targetId: 'TASK-' + type, targetName: '到点发送通知任务'
  })
  const due = dueList(type)
  const now = fmtTime(new Date())
  due.forEach((m) => {
    m.status = 'SENT'
    m.sendTime = now
    m.failReason = ''
    m.resendCount = m.resendCount || 0
  })
  if (due.length) {
    log({
      module: 'MSG', page: '消息通知', action: 'UPDATE',
      targetType: '通知任务', targetId: 'TASK-' + type, targetName: '到点发送通知任务',
      patientId: null, before: { 待发送: due.length }, after: { 已发送: due.length },
      reason: '扫描到点的入院前提醒，自动发送 ' + due.length + ' 条'
    })
    persist()
  }
  return due.length
}

/** RULE-MSG-001：参数变更后，未发送的入院前提醒按新提前天数重算，返回受影响条数 */
export function recalcPendingSafe(preAdmissionNoticeDays) {
  const days = Number(preAdmissionNoticeDays || 1)
  let count = 0
  state.messages.forEach((m) => {
    if (m.type !== 'PRE_ADMISSION' || m.status !== 'PENDING') return
    const p = getPatient(m.patientId)
    if (!p) return
    const sch = state.schedules.find((s) => s.patientId === m.patientId && ['SCHEDULED', 'CHANGED'].includes(s.status))
    const base = sch ? sch.surgeryDate : p.plannedSurgeryDate
    if (!base) return
    const d = new Date(base + 'T00:00:00')
    d.setDate(d.getDate() - days)
    m.planSendTime = d.toISOString().slice(0, 10) + ' 09:00:00'
    count++
  })
  return count
}
