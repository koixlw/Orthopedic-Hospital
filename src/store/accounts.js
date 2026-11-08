// OBJ-DEP-001 / 002 / 003 专项储值金账户、流水、门诊结算单（3.3—3.5）
// ▲招标第 8 项的实现处：缴存 → 冻结 → 转入住院储值金 / 退出日间手术门诊结算，全程留痕
// 分单：一次日间手术一张分单（分单号 = 关联申请单号），同一患者多次日间手术可分单管理、分别结算
import { computed } from 'vue'
import { state, persist } from './db'
import { log } from './logs'
import { get as getPatient } from './patients'
import { fmtAmount, fmtTime, round2 } from '@/utils/format'
import { goStatus, assertCan } from '@/utils/guard'
import { ACCOUNT_STATUS, FLOW_TYPE } from '@/mock/dict'

export { ACCOUNT_STATUS, FLOW_TYPE }

/** 默认「已产生的门诊费用」（附录 B Q-04 默认口径：合计 ¥560.00） */
export const DEFAULT_CHARGED = [
  { name: '血常规检验', amount: 180 },
  { name: '凝血四项', amount: 260 },
  { name: '心电图检查', amount: 120 }
]

/** 冻结用途候选（问题描述：冻结必须填写用途） */
export const FREEZE_PURPOSES = [
  '术前检查费用记账',
  '术前检查检验费用记账',
  '手术费用预缴',
  '麻醉费用预缴'
]

/** 分单状态 */
export const SUB_STATUS = {
  NORMAL: { label: '未冻结', type: 'info' },
  FROZEN: { label: '已冻结', type: 'warning' },
  TRANSFERRED: { label: '已转住院', type: 'primary' },
  SETTLED: { label: '已结算', type: 'success' }
}

export const all = computed(() => state.accounts)

export function accountOf(patientId) {
  return state.accounts.find((a) => a.patientId === patientId) || null
}

/** 流水倒序（最新在上） */
export function flowsOf(patientId) {
  const a = accountOf(patientId)
  if (!a) return []
  return a.flows.slice().sort((x, y) => (x.time < y.time ? 1 : -1))
}

/** 分单列表：一次日间手术一张，冻结金额独立核算、分别结算 */
export function subOrdersOf(patientId) {
  const a = accountOf(patientId)
  if (!a) return []
  return a.subOrders || []
}

/** 该患者可关联的日间手术申请单（用于冻结表单选择关联申请单号） */
export function applyNosOf(patientId) {
  return state.applies
    .filter((a) => a.patientId === patientId)
    .map((a) => a.applyNo)
}

/**
 * 金额铁律（5.4）：available + frozen + inpatientDeposit + consumed + refunded === totalDeposit
 * consumed 记「已扣的门诊费用」，refunded 记「已退回患者的余额」，两项都在结算单里分开列示
 */
function refundedOf(account) {
  if (account.refunded !== undefined && account.refunded !== null) return Number(account.refunded)
  return Number(account.settlement?.refund || 0)
}

export function assertBalance(account) {
  if (!account) return true
  const sum = round2(
    Number(account.available || 0) + Number(account.frozen || 0) +
    Number(account.inpatientDeposit || 0) + Number(account.consumed || 0) + refundedOf(account)
  )
  const total = round2(Number(account.totalDeposit || 0))
  if (sum !== total) {
    console.error('[assertBalance] 账户金额不平', {
      accountId: account.accountId, available: account.available, frozen: account.frozen,
      inpatientDeposit: account.inpatientDeposit, consumed: account.consumed,
      refunded: refundedOf(account), sum, total
    })
    throw new Error('账户金额不平，操作已中止')
  }
  return true
}

function pushFlow(account, type, amount, remark, extra = {}) {
  const flow = {
    flowId: 'F' + String(account.flows.length + 1).padStart(4, '0') + '-' + Date.now().toString().slice(-4),
    time: fmtTime(new Date()),
    type,
    amount: round2(amount),
    balance: round2(account.available),
    purpose: extra.purpose || '',
    applyNo: extra.applyNo || '',
    validUntil: extra.validUntil || '',
    subOrderNo: extra.subOrderNo || '',
    remark,
    operator: state.session.name,
    voided: false
  }
  account.flows.push(flow)
  return flow
}

function patientLabel(patientId) {
  const p = getPatient(patientId)
  return p ? p.name + ' ' + p.inpatientNo : patientId
}

function nextSettleNo() {
  const n = state.accounts.filter((a) => a.settlement).length + 1
  return 'JSM' + fmtTime(new Date()).slice(0, 10).replace(/-/g, '') + String(n).padStart(3, '0')
}

/**
 * 取（或新建）分单：分单号即关联申请单号
 * 同一申请单号多次冻结视为同一张分单，冻结金额累加
 */
function ensureSubOrder(account, form) {
  account.subOrders = account.subOrders || []
  let sub = account.subOrders.find((s) => s.orderNo === form.applyNo)
  const p = getPatient(account.patientId)
  const apply = state.applies.find((a) => a.applyNo === form.applyNo)
  if (!sub) {
    sub = {
      orderNo: form.applyNo,
      applyNo: form.applyNo,
      applyId: apply?.applyId || '',
      surgeryName: p?.surgeryName || apply?.surgeryName || '',
      plannedSurgeryDate: p?.plannedSurgeryDate || apply?.plannedSurgeryDate || '',
      purpose: '',
      validFrom: '',
      validTo: '',
      frozen: 0,
      status: 'NORMAL',
      settlement: null,
      createdAt: fmtTime(new Date()),
      createdBy: state.session.name
    }
    account.subOrders.push(sub)
  }
  return sub
}

/** 账户状态由各分单汇总推导 */
function refreshAccountStatus(account) {
  const subs = account.subOrders || []
  if (subs.length && subs.every((s) => s.status === 'SETTLED')) { account.status = 'SETTLED'; return }
  if (subs.some((s) => s.status === 'TRANSFERRED')) { account.status = 'TRANSFERRED_IN'; return }
  if (subs.some((s) => Number(s.frozen) > 0)) { account.status = 'FROZEN'; return }
  account.status = 'NORMAL'
}

/* ---------------- FUNC-DEP-001 缴存 ---------------- */
export function deposit(patientId, amount, payMethod = '现金') {
  assertCan('dep.deposit', { module: 'DEP', page: '储值金管理', action: 'CREATE', label: '办理储值金缴存', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  const amt = round2(Number(amount))
  if (!(amt > 0)) throw new Error('缴存金额必须大于 0')
  if (account.status === 'SETTLED') throw new Error('该账户已完成门诊结算，不能再次缴存')
  const before = { totalDeposit: account.totalDeposit, available: account.available }

  account.totalDeposit = round2(account.totalDeposit + amt)
  account.available = round2(account.available + amt)
  // 缴存无用途（问题描述：缴存用途为空）
  const flow = pushFlow(account, 'DEPOSIT', amt, '门诊缴存日间手术专项储值金（' + payMethod + '）')

  log({
    module: 'DEP', page: '储值金管理', action: 'CREATE',
    targetType: '储值金流水', targetId: flow.flowId, targetName: patientLabel(patientId),
    patientId, before: null,
    after: { 发生金额: fmtAmount(amt), 业务类型: '缴存', 可用余额: fmtAmount(account.available) },
    reason: '门诊缴存日间手术专项储值金（' + payMethod + '）'
  })
  assertBalance(account)
  persist()
  return { account, flow }
}

/* ---------------- FUNC-DEP-002 冻结 ▲ ----------------
 * 冻结必须填写：金额、用途、有效期、关联申请单号；确认后冻结，冻结金额专款专用
 */
export function freeze(patientId, form = {}) {
  assertCan('dep.freeze', { module: 'DEP', page: '储值金管理', action: 'UPDATE', label: '冻结储值金', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  if (account.status === 'SETTLED') throw new Error('该账户已完成门诊结算，不能再冻结')

  const amt = round2(Number(form.amount))
  if (!(amt > 0)) throw new Error('冻结金额必须大于 0')
  if (!form.purpose) throw new Error('请填写冻结用途')
  if (!form.validFrom) throw new Error('请选择有效期开始日期')
  if (!form.validTo) throw new Error('请选择有效期截止日期')
  if (form.validTo < form.validFrom) throw new Error('有效期截止日期不能早于开始日期')
  if (!form.applyNo) throw new Error('请填写关联申请单号')

  const available = round2(account.available)
  if (amt > available) throw new Error('冻结金额不能超过可用余额 ¥' + fmtAmount(available))

  const before = { available: fmtAmount(available), frozen: fmtAmount(account.frozen), status: account.status }
  const sub = ensureSubOrder(account, form)

  account.available = round2(account.available - amt)
  account.frozen = round2(account.frozen + amt)
  sub.frozen = round2(sub.frozen + amt)
  sub.purpose = form.purpose
  sub.validFrom = form.validFrom
  sub.validTo = form.validTo
  sub.status = 'FROZEN'
  refreshAccountStatus(account)

  const flow = pushFlow(
    account, 'FREEZE', -amt,
    '冻结 ¥' + fmtAmount(amt) + '（用途：' + form.purpose + '；分单 ' + sub.orderNo + '）',
    { purpose: form.purpose, applyNo: sub.orderNo, validUntil: form.validTo, subOrderNo: sub.orderNo }
  )

  log({
    module: 'DEP', page: '储值金管理', action: 'STATUS',
    targetType: '储值金账户', targetId: account.accountId, targetName: patientLabel(patientId),
    patientId, before,
    after: {
      可用余额: fmtAmount(account.available), 冻结金额: fmtAmount(account.frozen),
      冻结用途: form.purpose, 关联申请单号: sub.orderNo, 有效期至: form.validTo
    },
    reason: '储值金冻结（专款专用）：' + form.purpose
  })
  assertBalance(account)
  persist()
  return { account, flow, subOrder: sub }
}

/* ---------------- FUNC-DEP-003 转入住院储值金 ▲ ---------------- */
export function transferIn(patientId) {
  assertCan('dep.transfer', { module: 'DEP', page: '储值金管理', action: 'UPDATE', label: '转入住院储值金', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  const frozenSubs = (account.subOrders || []).filter((s) => Number(s.frozen) > 0 && s.status !== 'SETTLED')
  if (!frozenSubs.length) throw new Error('储值金未冻结，无法转入住院储值金')
  const amt = round2(account.frozen)
  if (!(amt > 0)) throw new Error('冻结金额为 0，无法转入住院储值金')

  const before = { frozen: fmtAmount(account.frozen), inpatientDeposit: fmtAmount(account.inpatientDeposit), status: account.status }
  account.frozen = 0
  account.inpatientDeposit = round2(account.inpatientDeposit + amt)
  // 逐分单转出：每张分单各记一笔转住院流水
  frozenSubs.forEach((sub) => {
    const subAmt = round2(sub.frozen)
    sub.frozen = 0
    sub.status = 'TRANSFERRED'
    pushFlow(
      account, 'TRANSFER_IN', subAmt,
      '入院登记，冻结金额转入住院储值金（分单 ' + sub.orderNo + '）',
      { purpose: '转住院储值金', applyNo: sub.orderNo, subOrderNo: sub.orderNo }
    )
  })
  refreshAccountStatus(account)

  const patient = getPatient(patientId)
  if (patient && ['SCHEDULED', 'DAY_SURGERY'].includes(patient.status)) {
    goStatus(patient, 'ADMITTED', { by: state.session.name, text: '入院登记：储值金转入住院储值金' })
  }

  log({
    module: 'DEP', page: '储值金管理', action: 'STATUS',
    targetType: '储值金账户', targetId: account.accountId, targetName: patientLabel(patientId),
    patientId, before,
    after: { 冻结金额: '0.00', 住院储值金: fmtAmount(account.inpatientDeposit), 账户状态: '已转入住院' },
    reason: '入院登记，冻结金额转入住院储值金'
  })
  assertBalance(account)
  persist()
  return { account }
}

/* ---------------- FUNC-DEP-004 发起退出日间手术 ▲ ----------------
 * 只退出日间手术路径，不动资金：冻结金额仍需由收费员办理解冻与门诊结算
 * opts.auto = true 时为系统自动退出（评估不通过触发），不校验操作岗位
 */
export function exitDaySurgery(patientId, reason, note = '', opts = {}) {
  if (!opts.auto) {
    assertCan('dep.exit', { module: 'DEP', page: '储值金管理', action: 'STATUS', label: '发起退出日间手术', targetType: '患者' })
  }
  if (!reason) throw new Error('请选择退出原因')
  const patient = getPatient(patientId)
  if (!patient) throw new Error('未找到该患者')
  if (['WITHDRAWN', 'DISCHARGED'].includes(patient.status)) throw new Error('该患者已结束日间手术流程')
  const account = accountOf(patientId)
  if (account && account.status === 'TRANSFERRED_IN') {
    throw new Error('储值金已转入住院账户，不能按退出日间手术处理')
  }

  const before = { 患者状态: patient.status }
  const at = fmtTime(new Date())
  patient.withdrawInfo = {
    reason,
    note,
    at,
    operator: opts.auto ? '系统自动' : state.session.name,
    auto: !!opts.auto
  }
  goStatus(patient, 'WITHDRAWN', {
    by: patient.withdrawInfo.operator,
    text: (opts.auto ? '评估不通过，自动退出日间手术：' : '发起退出日间手术：') + reason
  })

  log({
    module: 'DEP', page: '储值金管理', action: 'STATUS',
    targetType: '患者', targetId: patient.inpatientNo, targetName: patientLabel(patientId),
    patientId, before, after: { 患者状态: '已退出', 退出原因: reason },
    reason: (opts.auto ? '评估不通过自动退出：' : '发起退出日间手术：') + reason + (note ? '（' + note + '）' : '')
  })
  persist()
  return patient
}

/* ---------------- FUNC-DEP-005 解冻储值金并门诊结算 ▲ ----------------
 * 收费员操作：必须已满足退出条件（手工发起退出 / 评估不通过自动退出），
 * 否则提示「当前手术未完成，无法解除冻结」
 * 按分单分别结算：每张冻结分单各自生成一张结算单、各自退回余额
 */
export function unfreeze(patientId, chargedLines = DEFAULT_CHARGED) {
  assertCan('dep.unfreeze', { module: 'DEP', page: '储值金管理', action: 'UPDATE', label: '解冻储值金并门诊结算', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  const patient = getPatient(patientId)

  // 解冻前置条件：必须已退出日间手术路径
  if (!patient || patient.status !== 'WITHDRAWN') {
    throw new Error('当前手术未完成，无法解除冻结')
  }
  if (account.status === 'SETTLED') throw new Error('该账户已完成门诊结算，不能重复解冻')
  if (account.status === 'TRANSFERRED_IN') throw new Error('储值金已转入住院账户，无法解冻')

  const subs = (account.subOrders || []).filter((s) => Number(s.frozen) > 0 && s.status !== 'SETTLED')
  if (!subs.length) throw new Error('该账户没有可解冻的金额')

  const reason = patient.withdrawInfo?.reason || '患者放弃'
  const note = patient.withdrawInfo?.note || ''
  const before = {
    available: fmtAmount(account.available), frozen: fmtAmount(account.frozen),
    账户状态: ACCOUNT_STATUS[account.status]?.label || account.status
  }

  const settlements = []
  subs.forEach((sub) => {
    const total = round2(sub.frozen)
    const lines = (chargedLines || DEFAULT_CHARGED).map((l) => ({ name: l.name, amount: round2(l.amount) }))
    const chargedTotal = round2(lines.reduce((s, l) => s + l.amount, 0))
    if (chargedTotal > total) throw new Error('已产生门诊费用大于分单 ' + sub.orderNo + ' 的冻结金额，无法结算')
    const refund = round2(total - chargedTotal)

    // ① 解冻（解冻不计流水，由下面的门诊记账流水一次性体现）
    account.frozen = round2(account.frozen - total)
    account.available = round2(account.available + total)
    // ② 扣除已产生门诊费用
    account.available = round2(account.available - chargedTotal)
    account.consumed = round2(Number(account.consumed || 0) + chargedTotal)
    // ③ 余额退回患者
    account.refunded = round2(Number(account.refunded || 0) + refund)
    account.available = round2(account.available - refund)

    const settleNo = nextSettleNo()
    const settlement = {
      settlementNo: settleNo,
      at: fmtTime(new Date()),
      reason,
      note,
      lines,
      total: chargedTotal,
      refund,
      applyNo: sub.orderNo
    }
    sub.frozen = 0
    sub.status = 'SETTLED'
    sub.settlement = settlement
    settlements.push(settlement)

    pushFlow(
      account, 'OUTPATIENT_CHARGE', -total,
      '解冻并门诊结算：扣除已产生费用 ¥' + fmtAmount(chargedTotal) + '，退回 ¥' + fmtAmount(refund) +
        '（分单 ' + sub.orderNo + '）',
      { purpose: sub.purpose || '术前检查费用记账', applyNo: sub.orderNo, subOrderNo: sub.orderNo }
    )
  })

  account.settlement = settlements[settlements.length - 1]
  account.settlements = (account.settlements || []).concat(settlements)
  refreshAccountStatus(account)

  if (patient) {
    patient.withdrawInfo = {
      ...(patient.withdrawInfo || {}),
      settleNo: account.settlement.settlementNo,
      unfrozenAt: fmtTime(new Date()),
      unfrozenBy: state.session.name
    }
  }

  log({
    module: 'DEP', page: '储值金管理', action: 'STATUS',
    targetType: '门诊结算单', targetId: account.settlement.settlementNo, targetName: patientLabel(patientId),
    patientId, before,
    after: {
      账户状态: '已结算', 分单数: String(settlements.length),
      费用合计: fmtAmount(account.consumed), 退回金额: fmtAmount(account.refunded),
      结算单号: settlements.map((s) => s.settlementNo).join('、')
    },
    reason: '解冻储值金并门诊结算：' + reason + (note ? '（' + note + '）' : '')
  })
  assertBalance(account)
  persist()
  return settlements
}

/* ---------------- FUNC-DEP-006 缴存记录冲正（红冲） ---------------- */
export function reverseFlow(patientId, flowId, reason) {
  assertCan('dep.reverse', { module: 'DEP', page: '储值金管理', action: 'REVERSE', label: '冲正储值金流水', targetType: '储值金流水' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  if (!reason) throw new Error('请选择冲正原因')
  const flow = account.flows.find((f) => f.flowId === flowId)
  if (!flow) throw new Error('未找到该笔储值金流水')
  if (flow.type !== 'DEPOSIT') throw new Error('只有缴存记录可以冲正')
  if (flow.voided) throw new Error('该笔缴存已冲正，不能重复冲正')
  if (account.status === 'SETTLED') throw new Error('该账户已完成门诊结算，不能冲正')
  if (Number(flow.amount) > Number(account.available)) throw new Error('该笔缴存已被业务引用（冻结/转住院），不能冲正')

  const before = { totalDeposit: fmtAmount(account.totalDeposit), available: fmtAmount(account.available) }
  flow.voided = true
  flow.voidReason = reason
  account.totalDeposit = round2(account.totalDeposit - Number(flow.amount))
  account.available = round2(account.available - Number(flow.amount))
  const rev = pushFlow(account, 'REVERSE', -Number(flow.amount), '冲正：' + reason + '（原流水 ' + flow.flowId + '）',
    { purpose: reason })

  log({
    module: 'DEP', page: '储值金管理', action: 'REVERSE',
    targetType: '储值金流水', targetId: rev.flowId, targetName: patientLabel(patientId),
    patientId, before,
    after: { 原流水: flow.flowId, 冲正金额: fmtAmount(flow.amount), 可用余额: fmtAmount(account.available) },
    reason: '冲正 ' + flow.flowId + '：' + reason
  })
  assertBalance(account)
  persist()
  return { account, flow: rev }
}
