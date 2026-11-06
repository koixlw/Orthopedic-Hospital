// OBJ-EVL-001 术前评估记录（3.15）
// ▲招标第 9 项：专科 / 麻醉双评估，不通过必须选原因（RULE-EVL-002），ASA ≥ III 必填风险说明
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { fmtTime } from '@/utils/format'

export const SPECIALIST = 'SPECIALIST'
export const ANESTHESIA = 'ANESTHESIA'

export const ASA_LEVELS = ['ASA I', 'ASA II', 'ASA III', 'ASA IV']

export const TYPE_LABEL = { SPECIALIST: '专科评估', ANESTHESIA: '麻醉评估' }

/**
 * 术前评估列表的 5 种状态（问题描述口径）
 * 判定顺序：已出结论优先，其次看检查报告是否齐全，最后看评估到了哪一步。
 */
export const EVAL_STATUS = {
  REPORT_PENDING: { label: '报告未完成', type: 'warning', action: '待报告' },
  SPECIALIST_PENDING: { label: '待专科评估', type: 'primary', action: '专科评估' },
  ANESTHESIA_PENDING: { label: '待麻醉评估', type: 'primary', action: '麻醉评估' },
  FINISHED: { label: '已完成', type: 'success', action: '查看' },
  FAILED: { label: '评估不通过', type: 'danger', action: '查看' }
}

export const EVAL_STATUS_ORDER = ['REPORT_PENDING', 'SPECIALIST_PENDING', 'ANESTHESIA_PENDING', 'FINISHED', 'FAILED']

export function listOf(patientId) {
  return state.evals.filter((e) => e.patientId === patientId)
}

/** 该患者某类评估最近一次未撤销的记录 */
export function latest(patientId, type) {
  const list = listOf(patientId).filter((e) => e.type === type && !e.voided)
  return list.length ? list[list.length - 1] : null
}

const OPEN = ['DAY_SURGERY', 'SCHEDULED']

/** 报告完成度（医技系统回传的快照，落到患者主数据上供列表页同步读取） */
function progressOf(patient) {
  const rp = patient?.reportProgress
  if (!rp) return { done: 4, total: 4 }
  return { done: Number(rp.done || 0), total: Number(rp.total || 0) }
}

/**
 * 患者当前所处的术前评估状态（5 选 1）
 * 已出结论（通过 / 不通过）优先；未出结论时先看报告是否齐全，再看评估进度。
 */
export function statusOf(patient) {
  if (!patient) return ''
  const s = patient.evalStatus?.specialist
  const a = patient.evalStatus?.anesthesia
  if (s === 'FAILED' || a === 'FAILED') return 'FAILED'
  if (s === 'PASSED' && a === 'PASSED') return 'FINISHED'
  const rp = progressOf(patient)
  if (rp.total > 0 && rp.done < rp.total) return 'REPORT_PENDING'
  if (s !== 'PASSED') return 'SPECIALIST_PENDING'
  return 'ANESTHESIA_PENDING'
}

/** 按状态取患者列表：三个「进行中」状态只统计仍在术前流程内的患者 */
export function listByStatus(status) {
  return state.patients.filter((p) => {
    if (statusOf(p) !== status) return false
    if (['REPORT_PENDING', 'SPECIALIST_PENDING', 'ANESTHESIA_PENDING'].includes(status)) {
      return OPEN.includes(p.status)
    }
    return true
  })
}

/** 待专科评估：报告已齐、专科还处在待评估 */
export function pendingSpecialist() {
  return listByStatus('SPECIALIST_PENDING')
}

/** 待麻醉评估：专科已通过、麻醉未出结论 */
export function pendingAnesthesia() {
  return listByStatus('ANESTHESIA_PENDING')
}

/** 已完成：双评估均通过 */
export function finished() {
  return listByStatus('FINISHED')
}

/** 不通过：任一类评估结论为不通过 */
export function failed() {
  return listByStatus('FAILED')
}

function nextEvalId() {
  return 'EVL' + String(state.evals.length + 1).padStart(3, '0')
}

function assertConclusion(form) {
  if (!form || !['PASSED', 'FAILED'].includes(form.conclusion)) throw new Error('请选择评估结论')
  if (form.conclusion === 'FAILED') {
    if (!form.reason) throw new Error('评估结论为「不通过」时必须选择未通过原因')
    if (form.reason === '其他' && !String(form.reasonNote || '').trim()) {
      throw new Error('选择「其他」时必须填写具体说明')
    }
  }
}

/** 专科评估（FUNC-EVL-003） */
export function submitSpecialist(patientId, form) {
  assertCan('eval.submit', { module: 'EVL', page: '术前评估', action: 'CREATE', label: '提交评估结论', targetType: '评估记录' })
  const p = getPatient(patientId)
  if (!p) throw new Error('未找到该患者')
  if (latest(patientId, SPECIALIST)) throw new Error('该患者已有专科评估结论，评估结论一经提交不可撤销')
  assertConclusion(form)
  if (p.evalStatus?.anesthesia === 'FAILED') throw new Error('麻醉评估已判定不通过，不能再提交专科评估')

  const record = {
    evalId: nextEvalId(),
    patientId,
    type: SPECIALIST,
    conclusion: form.conclusion,
    reason: form.conclusion === 'FAILED' ? form.reason : '',
    reasonNote: form.conclusion === 'FAILED' ? (form.reasonNote || '') : '',
    asa: '',
    anesthesiaMethod: '',
    riskNote: '',
    opinion: form.opinion || '',
    doctor: state.session.name,
    time: fmtTime(new Date()),
    voided: false,
    voidReason: ''
  }
  state.evals.push(record)

  const before = { 专科评估: '待评估' }
  p.evalStatus = { ...(p.evalStatus || {}), specialist: form.conclusion }
  if (form.conclusion === 'FAILED') {
    p.evalFailReason = form.reason === '其他' ? (form.reasonNote || '其他') : form.reason
  }

  log({
    module: 'EVL', page: '术前评估', action: 'CREATE',
    targetType: '术前评估', targetId: record.evalId, targetName: p.name + ' ' + p.inpatientNo,
    patientId, before,
    after: {
      结论: form.conclusion === 'PASSED' ? '通过' : '不通过',
      评估类型: '专科评估',
      未通过原因: record.reason || '—'
    },
    reason: record.reason ? record.reason + (record.reasonNote ? '：' + record.reasonNote : '') : (form.opinion || '术前检查报告齐全，准予进入日间手术流程')
  })
  persist()
  return record
}

/** 麻醉评估（FUNC-EVL-004） */
export function submitAnesthesia(patientId, form) {
  assertCan('eval.submit', { module: 'EVL', page: '术前评估', action: 'CREATE', label: '提交评估结论', targetType: '评估记录' })
  const p = getPatient(patientId)
  if (!p) throw new Error('未找到该患者')
  const sp = latest(patientId, SPECIALIST)
  if (!sp || sp.conclusion !== 'PASSED') throw new Error('专科评估未通过，不能进行麻醉评估')
  if (latest(patientId, ANESTHESIA)) throw new Error('该患者已有麻醉评估结论，评估结论一经提交不可撤销')
  assertConclusion(form)
  if (form.conclusion === 'PASSED') {
    if (!form.asa) throw new Error('请选择 ASA 分级')
    if (!form.anesthesiaMethod) throw new Error('请选择建议麻醉方式')
    if (['ASA III', 'ASA IV'].includes(form.asa) && !String(form.riskNote || '').trim()) {
      throw new Error('ASA III 级及以上患者必须填写麻醉风险说明')
    }
  }

  const record = {
    evalId: nextEvalId(),
    patientId,
    type: ANESTHESIA,
    conclusion: form.conclusion,
    reason: form.conclusion === 'FAILED' ? form.reason : '',
    reasonNote: form.conclusion === 'FAILED' ? (form.reasonNote || '') : '',
    asa: form.asa || '',
    anesthesiaMethod: form.anesthesiaMethod || '',
    riskNote: form.riskNote || '',
    opinion: form.opinion || '',
    doctor: state.session.name,
    time: fmtTime(new Date()),
    voided: false,
    voidReason: ''
  }
  state.evals.push(record)

  const before = { 麻醉评估: '待评估' }
  p.evalStatus = { ...(p.evalStatus || {}), anesthesia: form.conclusion }
  if (form.conclusion === 'FAILED') {
    p.evalFailReason = form.reason === '其他' ? (form.reasonNote || '其他') : form.reason
  }

  log({
    module: 'EVL', page: '术前评估', action: 'CREATE',
    targetType: '术前评估', targetId: record.evalId, targetName: p.name + ' ' + p.inpatientNo,
    patientId, before,
    after: {
      结论: form.conclusion === 'PASSED' ? '通过' : '不通过',
      评估类型: '麻醉评估',
      ASA: record.asa || '—',
      建议麻醉方式: record.anesthesiaMethod || '—',
      未通过原因: record.reason || '—'
    },
    reason: record.riskNote || record.reason || form.opinion || '麻醉评估'
  })
  persist()
  return record
}

/** 取该患者最近一次不通过的原因（退出日间手术时自动预填，RULE-EVL-002 衔接） */
export function latestFailReasonOf(patientId) {
  const list = listOf(patientId).filter((e) => e.conclusion === 'FAILED' && !e.voided)
  if (!list.length) return null
  const last = list[list.length - 1]
  return { name: last.reason, note: last.reasonNote, evalId: last.evalId, type: last.type }
}
