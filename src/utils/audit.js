import { fmtTime } from './format'

export const ACTION_LABEL = {
  CREATE: '新增', UPDATE: '修改', REMOVE: '移除', VOID: '作废', REVERSE: '冲正',
  CANCEL: '撤销', DISABLE: '停用', ENABLE: '启用', STATUS: '状态变更',
  EXPORT: '导出', LOGIN: '角色切换'
}

export const ACTION_TYPE = {
  CREATE: 'success', UPDATE: 'primary', REMOVE: 'warning', VOID: 'info',
  REVERSE: 'danger', CANCEL: 'warning', DISABLE: 'info', ENABLE: 'success',
  STATUS: 'primary', EXPORT: 'primary', LOGIN: 'info'
}

export const MODULE_LABEL = {
  BAS: '工作台', APL: '手术申请', EVL: '术前评估', SCH: '手术排程', MSG: '消息通知',
  DEP: '储值金', ADM: '入院登记', TRF: '转住院', CIR: '手术报到',
  CHG: '手术费用', ORD: '手术医嘱', DICT: '基础字典', SYS: '系统'
}

export const MODULE_COLOR = {
  DEP: '#2B6CB0', ADM: '#2F855A', TRF: '#C05621', CHG: '#6B46C1',
  ORD: '#2C7A7B', BAS: '#4A5568', APL: '#2B6CB0', EVL: '#2F855A',
  SCH: '#C05621', MSG: '#2C7A7B', CIR: '#2F855A', DICT: '#718096', SYS: '#718096'
}

const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : String(v))

export function diffFields(before = {}, after = {}, labelMap = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  const out = []
  keys.forEach((k) => {
    const f = before?.[k]
    const t = after?.[k]
    if (String(f ?? '') === String(t ?? '')) return
    out.push({ field: k, label: labelMap[k] || k, from: fmt(f), to: fmt(t) })
  })
  return out
}

export function makeChain(seq, time, targetId, after) {
  const raw = `${seq}|${time}|${targetId}|${JSON.stringify(after || {})}`
  let h = 5381
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 8).toUpperCase()
}

export function makeEntry({
  seq, session, module, page, action, targetType, targetId, targetName,
  patientId, before, after, reason, result = 'SUCCESS', failReason
}) {
  const time = fmtTime(new Date())
  const diff = action === 'UPDATE' || action === 'STATUS' ? diffFields(before, after) : []
  return Object.freeze({
    seq,
    logId: 'LOG' + String(seq).padStart(8, '0'),
    time,
    operator: session.name,
    role: session.roleLabel,
    module,
    page,
    action,
    targetType,
    targetId,
    targetName,
    patientId: patientId || null,
    before: before || null,
    after: after || null,
    diff,
    reason: reason || '',
    result,
    failReason: failReason || '',
    client: 'Web / Chrome / 192.168.10.24',
    chain: makeChain(seq, time, targetId, after)
  })
}
