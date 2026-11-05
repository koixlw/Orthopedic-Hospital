// OBJ-APL-001 日间手术申请单（3.14）—— 流程起点
// 申请单只能从 HIS 接收，本系统不生产（6.12 禁用项）；患者只能由申请单建档产生
import { computed } from 'vue'
import dayjs from 'dayjs'
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { fmtTime } from '@/utils/format'
import { BIZ_MODES } from '@/mock/dict'

export const STATUS_MAP = {
  PENDING: { label: '待建档', type: 'primary' },
  ARCHIVED: { label: '已建档', type: 'info' },
  VOIDED: { label: '已退回', type: 'info' }
}

export const BIZ_MODE_TYPE = {
  手术麻醉: 'primary',
  手术不麻醉: 'success',
  麻醉不手术: 'warning'
}

export const RETURN_REASONS = ['患者取消手术', '开单信息错误', '重复开单', '不符合日间手术准入', '其他']

export const all = computed(() => state.applies)

export function get(applyId) {
  return state.applies.find((a) => a.applyId === applyId) || null
}

export function listByStatus(status) {
  if (!status) return state.applies
  return state.applies.filter((a) => a.status === status)
}

/**
 * 抗凝停药天数（RULE-APL-002）
 * 口径：距今已停药天数（today − 停药日期），不足 7 天不得建档（5.7.2 / T18 验收点）
 */
export function antiCoagDays(apply) {
  if (!apply || !apply.antiCoagulant) return null
  if (!apply.antiCoagStopDate) return 0
  const days = dayjs().startOf('day').diff(dayjs(apply.antiCoagStopDate).startOf('day'), 'day')
  return Math.max(0, days)
}

export function canApply(apply) {
  if (!apply) return false
  if (!apply.antiCoagulant) return true
  const d = antiCoagDays(apply)
  return d !== null && d >= 7
}

/** 抗凝状态展示文案：满足 7 天绿色，不足 7 天红字给出分母 */
export function antiCoagText(apply) {
  if (!apply || !apply.antiCoagulant) return { text: '—', type: 'info' }
  const d = antiCoagDays(apply)
  if (d >= 7) return { text: `已满 7 天（${d} 天）`, type: 'success' }
  return { text: `${d}/7 天`, type: 'danger' }
}

function nextApplyId() {
  const seq = state.applies.length + 1
  return 'APL' + dayjs().format('YYYYMMDD') + String(seq).padStart(3, '0')
}

/** FUNC-APL-001 接收 HIS 申请单（一次操作可多条，逐条留痕） */
export function receive(poolItems) {
  assertCan('apply.receive', { module: 'APL', page: '日间手术申请', action: 'CREATE', label: '接收申请单', targetType: '申请单' })
  const items = poolItems || []
  if (!items.length) throw new Error('请至少选择一条申请单')
  items.forEach((item) => {
    if (state.applies.some((a) => a.applyNo === item.applyNo)) {
      throw new Error('申请单 ' + item.applyNo + ' 已接收，不能重复接收')
    }
  })
  const created = []
  items.forEach((item) => {
    if (!BIZ_MODES.includes(item.bizMode)) {
      throw new Error('申请单 ' + item.applyNo + ' 业务模式不合法')
    }
    const apply = {
      applyId: nextApplyId(),
      applyNo: item.applyNo,
      patientId: '',
      patientName: item.patientName,
      gender: item.gender,
      age: item.age,
      inpatientNo: item.inpatientNo,
      idCard: item.idCard || '5101**********0000',
      phone: item.phone || '',
      bizMode: item.bizMode,
      surgeryName: item.surgeryName,
      surgeryCode: item.surgeryCode || '',
      plannedSurgeryDate: item.plannedSurgeryDate,
      surgeon: item.surgeon,
      diagnosis: item.diagnosis || '',
      antiCoagulant: !!item.antiCoagulant,
      antiCoagStopDate: item.antiCoagStopDate || '',
      applyDept: item.applyDept || '日间手术中心',
      applyDoctor: item.applyDoctor || '',
      applyTime: item.applyTime || fmtTime(new Date()),
      note: item.note || '',
      status: 'PENDING',
      returnReason: '',
      returnNote: '',
      createdAt: fmtTime(new Date()),
      createdBy: state.session.name + '（' + state.session.roleLabel + '）',
      removed: false
    }
    state.applies.push(apply)
    created.push(apply)
    log({
      module: 'APL', page: '手术申请', action: 'CREATE',
      targetType: '申请单', targetId: apply.applyNo, targetName: apply.patientName + ' ' + apply.inpatientNo,
      patientId: null, before: null,
      after: { 申请单号: apply.applyNo, 业务模式: apply.bizMode, 术式: apply.surgeryName },
      reason: '接收 HIS 日间手术申请单'
    })
  })
  persist()
  return created
}

/** FUNC-APL-002 修正申请单信息（已建档只允许改拟手术日与主刀） */
export function correct(applyId, patch, reason = '') {
  assertCan('apply.correct', { module: 'APL', page: '日间手术申请', action: 'UPDATE', label: '更正申请单', targetType: '申请单' })
  const apply = get(applyId)
  if (!apply) throw new Error('未找到该申请单')
  if (apply.status === 'VOIDED') throw new Error('该申请单已退回，不能修正')
  if (apply.status === 'ARCHIVED') {
    const allowed = ['plannedSurgeryDate', 'surgeon']
    const illegal = Object.keys(patch).filter((k) => !allowed.includes(k))
    if (illegal.length) throw new Error('该申请单已建档，仅可修改拟手术日与主刀医师')
  }
  const editable = ['bizMode', 'surgeryName', 'surgeryCode', 'plannedSurgeryDate', 'surgeon',
    'antiCoagulant', 'antiCoagStopDate', 'diagnosis', 'applyDept']
  const before = {}
  editable.forEach((k) => { if (k in patch) before[k] = apply[k] })
  editable.forEach((k) => { if (k in patch) apply[k] = patch[k] })
  log({
    module: 'APL', page: '手术申请 › 修正', action: 'UPDATE',
    targetType: '申请单', targetId: apply.applyNo, targetName: apply.patientName + ' ' + apply.inpatientNo,
    patientId: apply.patientId || null, before, after: { ...patch }, reason
  })
  persist()
  return apply
}

/** FUNC-APL-003 退回申请单（软作废，不删记录） */
export function returnApply(applyId, reason, note = '') {
  assertCan('apply.return', { module: 'APL', page: '日间手术申请', action: 'UPDATE', label: '退回申请单', targetType: '申请单' })
  const apply = get(applyId)
  if (!apply) throw new Error('未找到该申请单')
  if (apply.status === 'ARCHIVED') throw new Error('该申请单已建档，不能退回；如需终止请办理退出日间手术')
  if (apply.status === 'VOIDED') throw new Error('该申请单已退回，不能重复退回')
  if (!reason) throw new Error('请选择退回原因')
  const before = { 申请单状态: STATUS_MAP[apply.status]?.label || apply.status }
  apply.status = 'VOIDED'
  apply.returnReason = reason
  apply.returnNote = note
  log({
    module: 'APL', page: '手术申请', action: 'VOID',
    targetType: '申请单', targetId: apply.applyNo, targetName: apply.patientName + ' ' + apply.inpatientNo,
    patientId: null, before, after: { 申请单状态: '已退回', 退回原因: reason },
    reason: reason + (note ? '：' + note : '')
  })
  persist()
  return apply
}

/**
 * FUNC-BAS-003 从申请单建档（患者 + 储值金账户 + 状态轨迹）
 * 基本信息、住院号、术式、拟手术日、主刀由申请单带出，建档页面不可修改
 */
export function buildPatient(applyId, extra = {}) {
  assertCan('apply.build', { module: 'APL', page: '日间手术申请', action: 'CREATE', label: '为申请单建档', targetType: '申请单' })
  const apply = get(applyId)
  if (!apply) throw new Error('未找到该申请单')
  if (apply.status !== 'PENDING') throw new Error('该申请单状态不允许建档')
  if (!canApply(apply)) {
    throw new Error('抗凝停药不满 7 天，暂不可建档（当前 ' + antiCoagDays(apply) + '/7 天）')
  }
  if (state.patients.some((p) => p.inpatientNo === apply.inpatientNo)) {
    throw new Error('该住院号已建档，不能重复建档')
  }

  const seq = state.patients.length + 1
  const patientId = 'P' + String(seq).padStart(3, '0')
  const patient = {
    patientId,
    name: apply.patientName,
    gender: apply.gender,
    age: apply.age,
    inpatientNo: apply.inpatientNo,
    idCard: apply.idCard,
    phone: apply.phone,
    dept: (apply.applyDept || '').replace(/门诊$/, '') || '日间手术中心',
    bedNo: extra.bedNo || '',
    admissionCertNo: 'RJ' + apply.inpatientNo.replace(/^D/, ''),
    surgeryName: apply.surgeryName,
    surgeryCode: apply.surgeryCode,
    plannedSurgeryDate: apply.plannedSurgeryDate,
    surgeon: apply.surgeon,
    surgeryRoom: '',
    diagnosis: apply.diagnosis,
    status: 'DAY_SURGERY',
    allergy: extra.allergy || '无',
    applyId: apply.applyId,
    nurse: extra.nurse || '陈静',
    evalStatus: { specialist: 'PENDING', anesthesia: 'PENDING' },
    admissionInfo: null,
    transferInfo: null,
    withdrawInfo: null,
    statusLogs: [{ from: '', to: 'DAY_SURGERY', time: fmtTime(new Date()), by: state.session.name, text: '从申请单建档，进入术前准备' }]
  }
  state.patients.push(patient)

  // 建档同时自动创建专项储值金账户（totalDeposit = 0）
  state.accounts.push({
    accountId: 'A' + String(state.accounts.length + 1).padStart(3, '0'),
    patientId,
    totalDeposit: 0,
    available: 0,
    frozen: 0,
    inpatientDeposit: 0,
    consumed: 0,
    refunded: 0,
    status: 'NORMAL',
    settlement: null,
    flows: []
  })

  apply.status = 'ARCHIVED'
  apply.patientId = patientId

  log({
    module: 'BAS', page: '工作台', action: 'CREATE',
    targetType: '患者', targetId: apply.inpatientNo, targetName: patient.name + ' ' + patient.inpatientNo,
    patientId, before: null,
    after: { 住院号: patient.inpatientNo, 患者状态: '术前准备', 申请单号: apply.applyNo },
    reason: '从申请单 ' + apply.applyNo + ' 建档'
  })
  persist()
  return patient
}
