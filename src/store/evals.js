// OBJ-EVL-001 术前评估记录（3.15）
// ▲招标第 9 项：专科 / 麻醉双评估，不通过必须选原因（RULE-EVL-002），ASA ≥ III 必填风险说明
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { fmtTime } from '@/utils/format'

export const SPECIALIST = 'SPECIALIST'
export const ANESTHESIA = 'ANESTHESIA'

export const ASA_LEVELS = ['ASA I', 'ASA II', 'ASA III', 'ASA IV']

export const TYPE_LABEL = { SPECIALIST: '专科评估', ANESTHESIA: '麻醉评估' }

export function listOf(patientId) {
  return state.evals.filter((e) => e.patientId === patientId)
}

/** 该患者某类评估最近一次未撤销的记录 */
export function latest(patientId, type) {
  const list = listOf(patientId).filter((e) => e.type === type && !e.voided)
  return list.length ? list[list.length - 1] : null
}

const OPEN = ['DAY_SURGERY', 'SCHEDULED']

/** 待专科评估：专科还处在待评估 */
export function pendingSpecialist() {
  return state.patients.filter((p) =>
    OPEN.includes(p.status) && ['PENDING', undefined, null, ''].includes(p.evalStatus?.specialist))
}

/** 待麻醉评估：专科已通过、麻醉未出结论 */
export function pendingAnesthesia() {
  return state.patients.filter((p) =>
    OPEN.includes(p.status) && p.evalStatus?.specialist === 'PASSED' &&
    ['PENDING', undefined, null, ''].includes(p.evalStatus?.anesthesia))
}

/** 已完成：双评估均通过 */
export function finished() {
  return state.patients.filter((p) =>
    p.evalStatus?.specialist === 'PASSED' && p.evalStatus?.anesthesia === 'PASSED')
}

/** 不通过：任一类评估结论为不通过 */
export function failed() {
  return state.patients.filter((p) =>
    p.evalStatus?.specialist === 'FAILED' || p.evalStatus?.anesthesia === 'FAILED')
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
  const p = getPatient(patientId)
  if (!p) throw new Error('未找到该患者')
  if (latest(patientId, SPECIALIST)) throw new Error('该患者已有专科评估结论，如需修改请先撤销')
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
  const p = getPatient(patientId)
  if (!p) throw new Error('未找到该患者')
  const sp = latest(patientId, SPECIALIST)
  if (!sp || sp.conclusion !== 'PASSED') throw new Error('专科评估未通过，不能进行麻醉评估')
  if (latest(patientId, ANESTHESIA)) throw new Error('该患者已有麻醉评估结论，如需修改请先撤销')
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

/** FUNC-EVL-005 撤销评估结论（软作废，历史保留） */
export function revoke(patientId, type, reason) {
  if (!reason) throw new Error('请填写撤销原因')
  const rec = latest(patientId, type)
  if (!rec) throw new Error('未找到可撤销的' + (TYPE_LABEL[type] || '评估') + '记录')
  const p = getPatient(patientId)
  if (p && p.status === 'SCHEDULED' && type === ANESTHESIA) {
    throw new Error('该患者已完成手术预约，不能撤销评估，请先取消预约')
  }
  const before = { 结论: rec.conclusion === 'PASSED' ? '通过' : '不通过' }
  rec.voided = true
  rec.voidReason = reason
  if (p) {
    const key = type === SPECIALIST ? 'specialist' : 'anesthesia'
    p.evalStatus = { ...(p.evalStatus || {}), [key]: 'PENDING' }
    if (p.evalFailReason && type === SPECIALIST) p.evalFailReason = ''
  }
  log({
    module: 'EVL', page: '术前评估', action: 'VOID',
    targetType: '术前评估', targetId: rec.evalId, targetName: p ? p.name + ' ' + p.inpatientNo : patientId,
    patientId, before, after: { 结论: '已撤销', 评估状态: '待评估' }, reason
  })
  persist()
  return rec
}

/** 取该患者最近一次不通过的原因（退出日间手术时自动预填，RULE-EVL-002 衔接） */
export function latestFailReasonOf(patientId) {
  const list = listOf(patientId).filter((e) => e.conclusion === 'FAILED' && !e.voided)
  if (!list.length) return null
  const last = list[list.length - 1]
  return { name: last.reason, note: last.reasonNote, evalId: last.evalId, type: last.type }
}
