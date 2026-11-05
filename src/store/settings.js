// OBJ-SYS-002 系统参数（3.19）—— 全站唯一「没有列表」的页面
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { recalcPendingSafe } from './messages'
import { diffFields } from '@/utils/audit'
import { fmtTime } from '@/utils/format'

export const DEFAULT_SETTINGS = {
  preAdmissionNoticeDays: 1,
  autoSendAppointmentSms: true,
  changeNoticeChannel: 'BOTH',
  fastingTip: '术前 8 小时禁食、4 小时禁饮，请勿佩戴首饰、隐形眼镜，勿涂抹指甲油。'
}

export const SETTING_LABEL = {
  preAdmissionNoticeDays: '入院前通知提前天数',
  autoSendAppointmentSms: '预约成功短信自动发送',
  changeNoticeChannel: '安排变动通知渠道',
  fastingTip: '术前禁食提示语'
}

export const CHANNEL_OPTIONS = [
  { value: 'SMS', label: '仅短信' },
  { value: 'BOTH', label: '短信 + 电话' },
  { value: 'PHONE', label: '仅电话' }
]

/** FUNC-MSG-002 保存参数：校验 → 写参数 → 重算未发送提醒 → 留痕，返回受影响通知条数 */
export function save(form) {
  assertCan('param.save', { module: 'SYS', page: '系统参数', action: 'UPDATE', label: '修改系统参数', targetType: '系统参数' })
  const days = Number(form.preAdmissionNoticeDays)
  if (!(days >= 1 && days <= 7)) throw new Error('入院前通知提前天数必须在 1—7 天之间')
  if (!String(form.fastingTip || '').trim()) throw new Error('术前禁食提示语不能为空')

  const before = {}
  Object.keys(SETTING_LABEL).forEach((k) => { before[k] = state.settings[k] })
  const patch = {
    preAdmissionNoticeDays: days,
    autoSendAppointmentSms: !!form.autoSendAppointmentSms,
    changeNoticeChannel: form.changeNoticeChannel || 'BOTH',
    fastingTip: String(form.fastingTip).trim()
  }
  Object.assign(state.settings, patch)

  const affected = recalcPendingSafe(days)
  const diff = diffFields(before, patch, SETTING_LABEL)

  log({
    module: 'SYS', page: '系统参数', action: 'UPDATE',
    targetType: '系统参数', targetId: 'OBJ-SYS-002', targetName: '通知参数配置',
    patientId: null, before, after: { ...patch },
    reason: '保存系统参数' + (affected ? `，${affected} 条待发送通知的发送时间已重算` : '')
  })
  persist()
  return affected
}

export function restoreDefault() {
  assertCan('param.save', { module: 'SYS', page: '系统参数', action: 'UPDATE', label: '修改系统参数', targetType: '系统参数' })
  const before = {}
  Object.keys(SETTING_LABEL).forEach((k) => { before[k] = state.settings[k] })
  Object.assign(state.settings, { ...DEFAULT_SETTINGS })
  const affected = recalcPendingSafe(DEFAULT_SETTINGS.preAdmissionNoticeDays)
  log({
    module: 'SYS', page: '系统参数', action: 'UPDATE',
    targetType: '系统参数', targetId: 'OBJ-SYS-002', targetName: '通知参数配置',
    patientId: null, before, after: { ...DEFAULT_SETTINGS },
    reason: '恢复默认参数'
  })
  persist()
  return affected
}

export function lastSavedText() {
  return state.settings.updatedAt ? '上次保存 ' + fmtTime(new Date(state.settings.updatedAt)) : '本次会话未保存'
}
