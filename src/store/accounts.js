// OBJ-DEP-001 / 002 / 003 专项储值金账户、流水、门诊结算单（3.3—3.5）
// ▲招标第 8 项的实现处：缴存 → 冻结 → 转入住院储值金 / 退出日间手术门诊结算，全程留痕
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

function pushFlow(account, type, amount, remark) {
  const flow = {
    flowId: 'F' + String(account.flows.length + 1).padStart(4, '0') + '-' + Date.now().toString().slice(-4),
    time: fmtTime(new Date()),
    type,
    amount: round2(amount),
    balance: round2(account.available),
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

/* ---------------- FUNC-DEP-002 冻结 ▲ ---------------- */
export function freeze(patientId) {
  assertCan('dep.freeze', { module: 'DEP', page: '储值金管理', action: 'UPDATE', label: '冻结储值金', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  if (account.status === 'FROZEN') throw new Error('该账户储值金已冻结，不能重复冻结')
  if (account.status !== 'NORMAL') throw new Error('当前账户状态不可冻结')
  const amt = round2(account.available)
  if (!(amt > 0)) throw new Error('可用余额为 0，无可冻结金额')

  const before = { available: fmtAmount(account.available), frozen: fmtAmount(account.frozen), status: account.status }
  account.available = 0
  account.frozen = round2(account.frozen + amt)
  account.status = 'FROZEN'
  const flow = pushFlow(account, 'FREEZE', -amt, '术前检查费用记账，全额冻结')

  log({
    module: 'DEP', page: '储值金管理', action: 'STATUS',
    targetType: '储值金账户', targetId: account.accountId, targetName: patientLabel(patientId),
    patientId, before,
    after: { 可用余额: '0.00', 冻结金额: fmtAmount(account.frozen), 账户状态: '已冻结' },
    reason: '术前检查费用记账，储值金冻结'
  })
  assertBalance(account)
  persist()
  return { account, flow }
}

/* ---------------- FUNC-DEP-003 转入住院储值金 ▲ ---------------- */
export function transferIn(patientId) {
  assertCan('dep.transfer', { module: 'DEP', page: '储值金管理', action: 'UPDATE', label: '转入住院储值金', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  if (account.status !== 'FROZEN') throw new Error('储值金未冻结，无法转入住院储值金')
  const amt = round2(account.frozen)
  if (!(amt > 0)) throw new Error('冻结金额为 0，无法转入住院储值金')

  const before = { frozen: fmtAmount(account.frozen), inpatientDeposit: fmtAmount(account.inpatientDeposit), status: account.status }
  account.frozen = 0
  account.inpatientDeposit = round2(account.inpatientDeposit + amt)
  account.status = 'TRANSFERRED_IN'
  const flow = pushFlow(account, 'TRANSFER_IN', amt, '入院登记，冻结金额转入住院储值金')

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
  return { account, flow }
}

/* ---------------- FUNC-DEP-004 退出日间手术并门诊结算 ▲ ---------------- */
export function withdraw(patientId, reason, note = '', chargedLines = DEFAULT_CHARGED) {
  assertCan('dep.withdraw', { module: 'DEP', page: '储值金管理', action: 'UPDATE', label: '办理退出结算', targetType: '储值金账户' })
  const account = accountOf(patientId)
  if (!account) throw new Error('该患者尚未建立储值金账户')
  if (!reason) throw new Error('请选择退出原因')
  const patient = getPatient(patientId)

  if (account.status === 'TRANSFERRED_IN') throw new Error('储值金已转入住院账户，不能按退出日间手术处理')
  if (account.status === 'SETTLED') throw new Error('该账户已完成门诊结算，不能重复退出')
  const frozen = round2(account.frozen)
  const available = round2(account.available)
  const total = round2(frozen + available)
  if (total <= 0) throw new Error('该账户没有可结算的金额')

  const lines = (chargedLines || DEFAULT_CHARGED).map((l) => ({ name: l.name, amount: round2(l.amount) }))
  const chargedTotal = round2(lines.reduce((s, l) => s + l.amount, 0))
  if (chargedTotal > total) throw new Error('已产生门诊费用大于账户余额，无法结算')
  const refund = round2(total - chargedTotal)

  const before = {
    available: fmtAmount(available), frozen: fmtAmount(frozen),
    账户状态: ACCOUNT_STATUS[account.status]?.label || account.status
  }

  // ① 解冻（解冻不计流水，由下面的结算流水一次性体现）
  if (frozen > 0) {
    account.frozen = 0
    account.available = round2(account.available + frozen)
  }
  // ② 扣除已产生门诊费用
  account.available = round2(account.available - chargedTotal)
  account.consumed = round2(Number(account.consumed || 0) + chargedTotal)
  // ③ 余额退回患者
  account.refunded = round2(Number(account.refunded || 0) + refund)
  account.available = round2(account.available - refund)
  account.status = 'SETTLED'
  const settleNo = nextSettleNo()
  account.settlement = {
    settlementNo: settleNo,
    at: fmtTime(new Date()),
    reason,
    note,
    lines,
    total: chargedTotal,
    refund
  }
  account.flows.push({
    flowId: 'F' + String(account.flows.length + 1).padStart(4, '0') + '-' + Date.now().toString().slice(-4),
    time: fmtTime(new Date()),
    type: 'SETTLE',
    amount: -total,
    balance: round2(account.available),
    remark: '退出日间手术，门诊结算：扣除已产生费用 ¥' + fmtAmount(chargedTotal) + '，退回 ¥' + fmtAmount(refund),
    operator: state.session.name,
    voided: false
  })

  if (patient) {
    patient.withdrawInfo = {
      reason,
      note,
      at: fmtTime(new Date()),
      operator: state.session.name,
      settleNo
    }
    if (!['WITHDRAWN', 'DISCHARGED'].includes(patient.status)) {
      goStatus(patient, 'WITHDRAWN', { by: state.session.name, text: '退出日间手术：' + reason })
    }
  }

  log({
    module: 'DEP', page: '储值金管理', action: 'STATUS',
    targetType: '门诊结算单', targetId: settleNo, targetName: patientLabel(patientId),
    patientId, before,
    after: {
      账户状态: '已结算', 费用合计: fmtAmount(chargedTotal),
      退回金额: fmtAmount(refund), 结算单号: settleNo
    },
    reason: '退出日间手术：' + reason + (note ? '（' + note + '）' : '')
  })
  assertBalance(account)
  persist()
  return account.settlement
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
  if (account.status !== 'NORMAL') throw new Error('该笔缴存已被业务引用（冻结/转住院/已结算），不能冲正')
  if (Number(flow.amount) > Number(account.available)) throw new Error('该笔缴存已被业务引用，不能冲正')

  const before = { totalDeposit: fmtAmount(account.totalDeposit), available: fmtAmount(account.available) }
  flow.voided = true
  flow.voidReason = reason
  account.totalDeposit = round2(account.totalDeposit - Number(flow.amount))
  account.available = round2(account.available - Number(flow.amount))
  const rev = pushFlow(account, 'REVERSE', -Number(flow.amount), '冲正：' + reason + '（原流水 ' + flow.flowId + '）')

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
