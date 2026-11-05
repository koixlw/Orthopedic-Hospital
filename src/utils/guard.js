// 状态机拦截 + 前置校验 + 角色权限（5.3 / 5.9.3 / 4.2）
import { fmtTime } from './format'
import { state } from '@/store/state'
import { log } from '@/store/logs'

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

/* ---------------- 角色与权限（4.1 角色清单 / 4.2 四条实现约定） ---------------- */

/** 页面级权限码：与路由 meta.perm、侧栏菜单一一对应 */
export const PAGE_LABEL = {
  workbench: '工作台', apply: '日间手术申请', evaluate: '术前评估', schedule: '手术排程',
  deposit: '储值金管理', admission: '入院登记', checkin: '手术报到', charge: '手术费用',
  order: '手术医嘱', transfer: '转普通入院', dict: '基础字典', message: '消息通知',
  log: '操作日志', trace: '患者轨迹', setting: '系统参数'
}

/** 动作级权限码：用于失败日志里拼出可读原因，不写 permission denied */
export const PERM_LABEL = {
  ...PAGE_LABEL,
  'apply.receive': '接收申请单', 'apply.build': '为申请单建档', 'apply.correct': '更正申请单', 'apply.return': '退回申请单',
  'eval.submit': '提交评估结论', 'eval.revoke': '撤销评估结论',
  'sch.create': '创建手术预约', 'sch.adjust': '调整手术安排', 'sch.cancel': '取消手术预约',
  'dep.deposit': '办理储值金缴存', 'dep.freeze': '冻结储值金', 'dep.transfer': '转入住院储值金',
  'dep.withdraw': '办理退出结算', 'dep.reverse': '冲正储值金流水',
  'adm.confirm': '办理入院登记', 'adm.modify': '修改入院信息', 'adm.revoke': '撤销入院登记',
  'chk.confirm': '确认手术报到', 'chk.cancel': '取消报到', 'chk.print': '打印知情同意书',
  'chg.add': '录入手术费用', 'chg.import': '调入费用组套', 'chg.submit': '提交费用单',
  'chg.void': '作废费用单', 'chg.reenter': '重新录入费用',
  'ord.add': '录入手术医嘱', 'ord.stop': '停止医嘱', 'ord.void': '作废医嘱', 'ord.remove': '移除医嘱',
  'trf.submit': '转普通住院', 'trf.revoke': '撤销转普通住院',
  'dict.edit': '维护基础字典', 'dict.remove': '移除字典项', 'dict.toggle': '启停用字典项',
  'msg.resend': '重发通知', 'param.save': '修改系统参数', 'sys.reset': '重置演示数据'
}

/**
 * 角色 → 权限码。岗位职责取自 4.1：
 * NURSE 入院登记 / 储值金冻结与转入 / 退出结算；CASHIER 缴存 / 冻结 / 门诊结算；
 * DOCTOR 转普通住院 / 手术费用 / 手术医嘱（含专科与麻醉评估）；ADMIN 全部。
 */
const GRANTS = {
  // 逐条对照《开发任务单》的「功能—角色矩阵」，每个权限码后面标注来源功能编号
  NURSE: [
    // 页面：申请、排程、储值金（只做转入与退出，不碰钱箱）、入院、报到、医嘱（只读）、消息、轨迹
    'workbench', 'apply', 'schedule', 'deposit', 'admission', 'checkin', 'order', 'message', 'trace',
    'apply.receive', 'apply.build',            // FUNC-APL-001 接收申请单、FUNC-BAS-003 从申请单建档
    'sch.create', 'sch.adjust', 'sch.cancel',  // FUNC-SCH-001/003/004
    'dep.transfer', 'dep.withdraw',            // FUNC-DEP-003 转入住院储值金、FUNC-DEP-004 退出并门诊结算
    'adm.confirm', 'adm.modify', 'adm.revoke', // FUNC-ADM-002/004/005
    'chk.confirm', 'chk.cancel', 'chk.print',  // FUNC-CIR-001/002/003
    'msg.resend'                               // FUNC-MSG-001 重发通知
  ],
  CASHIER: [
    // 钱箱角色：缴存、冻结、冲正、门诊结算；不含「转入住院储值金」（DEP-003 属护士）
    'workbench', 'deposit', 'trace',
    'dep.deposit', 'dep.freeze', 'dep.withdraw', 'dep.reverse' // FUNC-DEP-001/002/004/006
  ],
  DOCTOR: [
    'workbench', 'apply', 'evaluate', 'charge', 'order', 'transfer', 'trace',
    'apply.correct', 'apply.return',           // FUNC-APL-002/003 开单医师修正、退回申请单
    'eval.submit', 'eval.revoke',              // FUNC-EVL-003/004/005
    'chg.add', 'chg.import', 'chg.submit', 'chg.void', 'chg.reenter', // FUNC-CHG-001~006
    'ord.add', 'ord.stop', 'ord.void', 'ord.remove',                  // FUNC-ORD-001/003/004/005
    'trf.submit', 'trf.revoke'                 // FUNC-TRF-001/004
  ],
  // 演示需要：管理员全绿，正式系统按岗位分离（README 与系统参数页均有说明）
  ADMIN: ['*']
}

export const ALL_PERMS = Object.keys(PERM_LABEL)

export function permsOf(role) {
  const g = GRANTS[role] || []
  return g.includes('*') ? ALL_PERMS : g
}

export function roleAllows(role, code) {
  if (!code) return true
  const g = GRANTS[role] || []
  return g.includes('*') || g.includes(code)
}

/**
 * 接口层强制校验（4.2 约定 2）：前端隐藏不作为安全手段。
 * 不通过 → 写一条 result=FAIL 的日志（原因可读）→ 抛出，由页面 catch 后提示。
 */
export function assertCan(code, ctx = {}) {
  if (roleAllows(state.session.role, code)) return true
  const what = ctx.label || PERM_LABEL[code] || '该操作'
  const msg = `当前角色（${state.session.roleLabel}）无权执行${what}`
  log({
    module: ctx.module || 'SYS',
    page: ctx.page || '',
    // 被拦截的尝试统一记 DENY：动作=权限拦截，对象=试图执行的动作，原因=可读说明
    action: 'DENY',
    targetType: ctx.targetType || '权限',
    targetId: ctx.targetId || code,
    targetName: ctx.targetName || what,
    patientId: ctx.patientId || null,
    reason: ctx.reason || '该岗位未开放此操作入口，请求被接口层拦截',
    result: 'FAIL',
    failReason: msg
  })
  throw new Error(msg)
}
