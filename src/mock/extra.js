// 补充演示数据：把初始种子尚未覆盖的业务分支补齐
//
// 与 dict.js 的初始种子分开存放，原因有二：
//   ① 同一场景往往横跨患者 / 账户 / 评估 / 排程 / 流水 / 医嘱 / 费用 / 通知 / 日志，
//      放在一起才看得出「这条演示讲的是一件事」；
//   ② 初始种子（dict.js）保持「每个状态一个主角」的节奏，补充数据集中成块，便于按场景查阅。
//
// 覆盖的分支（括号内为页面）：
//   · 抗凝停药已满 7 天 / 恰好 7 天、业务模式「麻醉不手术」（手术申请）
//   · ASA Ⅲ 级 + 必填风险说明（术前评估）
//   · 评估不通过：麻醉风险评估过高 / 血糖控制不佳 / 其他（术前评估）
//   · 评估列表三种在途状态各补样例：待专科 / 待麻醉 / 报告未完成（术前评估）
//   · 储值金部分冻结 + 多笔缴存、储值金冲正（储值金管理）
//   · 手工发起退出日间手术、多张分单各自结算（储值金管理）
//   · 排程状态：已报到 / 已取消、预约与实际安排不一致（手术排程）
//   · 报到后取消报到（手术报到）
//   · 撤销入院登记的成功分支（入院登记）
//   · 转住院：转科 / 重新开具住院证 / 术后出现并发症 / 患者及家属要求、撤销转住院（转普通入院）
//   · 费用单：编辑中 / 已作废 / 重新录入 + 已移除明细（手术费用）
//   · 医嘱全状态：待提交 / 口头 / 未执行 / 执行中 / 已执行 / 已停止 / 已作废 / 已移除（手术医嘱）
//   · 通知类型「取消通知」、状态「已作废」、渠道「短信 + 电话」、重发记录（消息通知）
//   · 操作日志动作类型：移除 / 撤销 / 冲正 / 导出 / 停用 / 启用 / 登录 / 退出登录 / 权限拦截（操作日志）
//   · 停用的收费项目、停用的费用组套（收费项目与药品 / 费用常用组套）
import dayjs from 'dayjs'
import { makeChain, diffFields } from '@/utils/audit'

/* 所有日期一律相对今天生成（与 dict.js 同一口径） */
const d = (n) => dayjs().add(n, 'day').format('YYYY-MM-DD')
const dt = (n, h, m, s = 0) =>
  dayjs().add(n, 'day').hour(h).minute(m).second(s).format('YYYY-MM-DD HH:mm:ss')

/** 证件号 / 手机号按序号派生 */
const idCardOf = (n) => '5101**********' + String(n).padStart(4, '0')
const phoneOf = (n) => '13' + String(n % 10) + '****' + String(1000 + (n % 9000)).slice(-4)

/** 患者构造器：固定字段统一补齐，各案例只写差异部分 */
function pt(id, base, extra = {}) {
  const n = Number(id.slice(1))
  return {
    patientId: id,
    idCard: idCardOf(n),
    phone: phoneOf(n),
    bedNo: '',
    surgeryCode: '',
    surgeryRoom: '',
    allergy: '无',
    applyId: '',
    nurse: '陈静',
    evalStatus: { specialist: 'PENDING', anesthesia: 'PENDING' },
    admissionInfo: null,
    transferInfo: null,
    withdrawInfo: null,
    statusLogs: [],
    ...base,
    ...extra
  }
}

/* ---------------- 补充演示患者（P101 起，避开初始种子与其它会话占用的号段） ----------------
 * P101 部分冻结 + 多笔缴存 + 预约与安排不一致
 * P102 ASA Ⅲ + 当日入院可撤销
 * P103 转住院 · 转科 · 术后出现并发症
 * P104 转住院后已撤销
 * P105 手工发起退出日间手术
 * P106 麻醉评估不通过 + 多分单分别结算
 * P107 报到后取消报到
 * P108 评估不通过（其他）
 * P109 预约已取消 + 储值金冲正
 * P110 手术完成当日离院
 * P111 费用作废重录 + 医嘱全状态
 * P112 评估不通过（血糖控制不佳）
 * P113 待专科评估  P114 待麻醉评估  P115 报告未完成
 */
export const extraPatients = [
  pt('P101', {
    name: '曹秀珍', gender: '女', age: 52, inpatientNo: 'D2026101',
    dept: '关节外科', surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001',
    plannedSurgeryDate: d(2), surgeon: '张海涛', surgeryRoom: '日间 2 间',
    diagnosis: '右膝内侧半月板损伤（Ⅱ级）', status: 'DAY_SURGERY',
    allergy: '青霉素', applyId: 'APL104',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' }
  }),
  pt('P102', {
    name: '徐蔚然', gender: '女', age: 34, inpatientNo: 'D2026102',
    dept: '运动医学科', surgeryName: '肩关节镜下肩峰成形术', surgeryCode: '81.8300',
    plannedSurgeryDate: d(1), surgeon: '周立', surgeryRoom: '日间 1 间',
    diagnosis: '右肩峰下撞击综合征', status: 'ADMITTED',
    allergy: '无', applyId: 'APL105', bedNo: '日间 08 床',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
    admissionInfo: {
      admissionCertNo: 'RJ2026102', bedNo: '日间 08 床', admittedAt: dt(0, 8, 15),
      guardian: '徐敏', guardianPhone: '137****3312',
      note: '当日入院且未产生费用，可验证「撤销入院登记」入口', operator: '陈静'
    }
  }),
  pt('P103', {
    name: '严文博', gender: '男', age: 58, inpatientNo: 'D2026103',
    dept: '创伤骨科', surgeryName: '骨折内固定取出术', surgeryCode: '78.6300',
    plannedSurgeryDate: d(-2), surgeon: '张海涛', surgeryRoom: '日间 3 间',
    diagnosis: '左胫骨骨折术后（内固定存留）', status: 'TRANSFERRED',
    allergy: '磺胺类', applyId: 'APL106', bedNo: '日间 09 床',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
    admissionInfo: {
      admissionCertNo: 'RJ2026103', bedNo: '日间 09 床', admittedAt: dt(-2, 7, 50),
      guardian: '严涛', guardianPhone: '135****6628', note: '术后切口渗血，转创伤骨科继续治疗', operator: '陈静'
    },
    transferInfo: {
      reason: '术后出现并发症', method: '转科',
      note: '术后切口渗血伴低热，转创伤骨科继续抗感染治疗，住院费用从住院储值金结算',
      at: dt(-2, 15, 40), operator: '张海涛'
    },
    transferHistory: [
      { time: dt(-2, 15, 40), operator: '张海涛', text: '转普通住院（术后出现并发症 · 转科）' }
    ]
  }),
  pt('P104', {
    name: '汤春燕', gender: '女', age: 45, inpatientNo: 'D2026104',
    dept: '脊柱外科', surgeryName: '后路腰椎减压椎间融合术', surgeryCode: '81.0800',
    plannedSurgeryDate: d(1), surgeon: '李伟', surgeryRoom: '日间 2 间',
    diagnosis: '腰 4/5 椎管狭窄症', status: 'ADMITTED',
    allergy: '无', applyId: 'APL107', bedNo: '日间 10 床',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
    admissionInfo: {
      admissionCertNo: 'RJ2026104', bedNo: '日间 10 床', admittedAt: dt(-1, 8, 5),
      guardian: '汤明', guardianPhone: '136****4477', note: '转住院当日撤销，已回到日间路径', operator: '陈静'
    },
    transferHistory: [
      { time: dt(-1, 9, 30), operator: '李伟', text: '转普通住院（患者及家属要求 · 重新开具住院证）' },
      { time: dt(-1, 14, 10), operator: '李伟', text: '撤销转住院（原因：录入错误，患者暂不转普通住院）', cancelled: true }
    ]
  }),
  pt('P105', {
    name: '钟启明', gender: '男', age: 43, inpatientNo: 'D2026105',
    dept: '手外科', surgeryName: '腕管切开减压术', surgeryCode: '04.4300',
    plannedSurgeryDate: d(-2), surgeon: '周立', surgeryRoom: '日间 2 间',
    diagnosis: '左腕管综合征（中度）', status: 'WITHDRAWN',
    allergy: '无', applyId: 'APL108',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PENDING' },
    withdrawInfo: {
      reason: '患者放弃', note: '患者临时家属反对手术，手工发起退出；冻结金额仍待收费员解冻结算',
      at: dt(-2, 11, 20), operator: '王芳', auto: false
    }
  }),
  pt('P106', {
    name: '侯小妮', gender: '女', age: 41, inpatientNo: 'D2026106',
    dept: '足踝外科', surgeryName: '拇外翻截骨矫形术', surgeryCode: '77.5100',
    plannedSurgeryDate: d(-3), surgeon: '张海涛', surgeryRoom: '日间 1 间',
    diagnosis: '左足踇外翻（中度）', status: 'WITHDRAWN',
    allergy: '无', applyId: 'APL109',
    evalStatus: { specialist: 'PASSED', anesthesia: 'FAILED' }, evalFailReason: '麻醉风险评估过高',
    withdrawInfo: {
      reason: '麻醉评估不通过', note: '麻醉风险评估过高：ASA IV 级，基础疾病控制不佳，不宜日间手术',
      at: dt(-3, 16, 5), operator: '系统自动', auto: true
    }
  }),
  pt('P107', {
    name: '沈云开', gender: '男', age: 36, inpatientNo: 'D2026107',
    dept: '关节外科', surgeryName: '膝关节镜下关节清理术', surgeryCode: '80.8600',
    plannedSurgeryDate: d(0), surgeon: '张海涛', surgeryRoom: '日间 1 间',
    diagnosis: '左膝关节游离体', status: 'ADMITTED',
    allergy: '无', applyId: 'APL110', bedNo: '日间 11 床', checkInStatus: 'NOT_CHECKED_IN',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
    admissionInfo: {
      admissionCertNo: 'RJ2026107', bedNo: '日间 11 床', admittedAt: dt(-1, 8, 25),
      guardian: '沈涛', guardianPhone: '138****7756', note: '报到后临时改期并撤回报到', operator: '陈静'
    }
  }),
  pt('P108', {
    name: '万家骏', gender: '男', age: 66, inpatientNo: 'D2026108',
    dept: '脊柱外科', surgeryName: '经皮椎体成形术（PKP）', surgeryCode: '81.6500',
    plannedSurgeryDate: d(-1), surgeon: '李伟', surgeryRoom: '日间 3 间',
    diagnosis: '腰 3 椎体骨质疏松性压缩骨折', status: 'WITHDRAWN',
    allergy: '无', applyId: 'APL111',
    evalStatus: { specialist: 'FAILED', anesthesia: 'PENDING' }, evalFailReason: '术前访视发现活动性感染灶',
    withdrawInfo: {
      reason: '评估不通过', note: '其他：术前访视发现牙周活动性感染灶，需抗感染治疗后再评估',
      at: dt(-1, 9, 50), operator: '系统自动', auto: true
    }
  }),
  pt('P109', {
    name: '顾爱民', gender: '男', age: 49, inpatientNo: 'D2026109',
    dept: '创伤骨科', surgeryName: '骨折内固定取出术', surgeryCode: '78.6300',
    plannedSurgeryDate: d(-1), surgeon: '张海涛', surgeryRoom: '日间 2 间',
    diagnosis: '右尺骨骨折术后（内固定存留）', status: 'DAY_SURGERY',
    allergy: '无', applyId: 'APL112',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' }
  }),
  pt('P110', {
    name: '龙玉兰', gender: '女', age: 66, inpatientNo: 'D2026110',
    dept: '足踝外科', surgeryName: '拇外翻截骨矫形术', surgeryCode: '77.5100',
    plannedSurgeryDate: d(-6), surgeon: '张海涛', surgeryRoom: '日间 1 间',
    diagnosis: '右足踇外翻（中重度）', status: 'DISCHARGED',
    allergy: '无', applyId: 'APL113', bedNo: '日间 02 床',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
    admissionInfo: {
      admissionCertNo: 'RJ2026110', bedNo: '日间 02 床', admittedAt: dt(-6, 7, 45),
      guardian: '龙涛', guardianPhone: '139****8890', note: '手术顺利，当日离院', operator: '陈静'
    }
  }),
  pt('P111', {
    name: '蒲一鸣', gender: '男', age: 39, inpatientNo: 'D2026111',
    dept: '关节外科', surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001',
    plannedSurgeryDate: d(1), surgeon: '张海涛', surgeryRoom: '日间 3 间',
    diagnosis: '左膝内侧半月板损伤（Ⅲ级）', status: 'ADMITTED',
    allergy: '无', applyId: 'APL114', bedNo: '日间 12 床',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
    admissionInfo: {
      admissionCertNo: 'RJ2026111', bedNo: '日间 12 床', admittedAt: dt(-1, 8, 50),
      guardian: '蒲刚', guardianPhone: '135****9901', note: '费用单曾作废并重新录入，医嘱待提交', operator: '陈静'
    }
  }),
  pt('P112', {
    name: '白玉兰', gender: '女', age: 55, inpatientNo: 'D2026112',
    dept: '脊柱外科', surgeryName: '经皮椎间孔镜下髓核摘除术', surgeryCode: '80.5100',
    plannedSurgeryDate: d(-2), surgeon: '李伟', surgeryRoom: '日间 2 间',
    diagnosis: '腰 4/5 椎间盘突出症（双侧）', status: 'WITHDRAWN',
    allergy: '磺胺类', applyId: 'APL115',
    evalStatus: { specialist: 'FAILED', anesthesia: 'PENDING' }, evalFailReason: '血糖控制不佳',
    withdrawInfo: {
      reason: '评估不通过', note: '血糖控制不佳：空腹血糖 13.2mmol/L，糖化血红蛋白 9.8%，暂不宜手术',
      at: dt(-2, 10, 25), operator: '系统自动', auto: true
    }
  }),
  pt('P113', {
    name: '温书瑶', gender: '女', age: 30, inpatientNo: 'D2026113',
    dept: '运动医学科', surgeryName: '肩关节镜下肩峰成形术', surgeryCode: '81.8300',
    plannedSurgeryDate: d(4), surgeon: '周立', surgeryRoom: '',
    diagnosis: '左肩峰下撞击综合征', status: 'DAY_SURGERY',
    allergy: '无', applyId: 'APL116',
    evalStatus: { specialist: 'PENDING', anesthesia: 'PENDING' }
  }),
  pt('P114', {
    name: '戚文轩', gender: '男', age: 50, inpatientNo: 'D2026114',
    dept: '手外科', surgeryName: '腕管切开减压术', surgeryCode: '04.4300',
    plannedSurgeryDate: d(3), surgeon: '周立', surgeryRoom: '',
    diagnosis: '右腕管综合征（轻度）', status: 'DAY_SURGERY',
    allergy: '青霉素', applyId: 'APL117',
    evalStatus: { specialist: 'PASSED', anesthesia: 'PENDING' }
  }),
  pt('P115', {
    name: '蓝月华', gender: '女', age: 28, inpatientNo: 'D2026115',
    dept: '创伤骨科', surgeryName: '骨折内固定取出术', surgeryCode: '78.6300',
    plannedSurgeryDate: d(5), surgeon: '张海涛', surgeryRoom: '',
    diagnosis: '右锁骨骨折术后（内固定存留）', status: 'DAY_SURGERY',
    allergy: '无', applyId: 'APL118',
    evalStatus: { specialist: 'PENDING', anesthesia: 'PENDING' }
  })
]

/* ---------------- 补充演示账户 ----------------
 * 金额铁律（可用 + 冻结 + 住院 + 已消耗 + 已退回 = 缴存总额）在每条上都要成立
 */
function flow(id, time, type, amount, balance, remark, operator, voided = false, extra = {}) {
  return {
    flowId: id, time, type, amount, balance,
    purpose: '', applyNo: '', validUntil: '', subOrderNo: '',
    remark, operator, voided, ...extra
  }
}

/** 分单：一次日间手术一张单，分单号即关联申请单号 */
function sub(orderNo, surgeryName, plannedSurgeryDate, purpose, validFrom, validTo, frozen, status, settlement = null) {
  return {
    orderNo, applyNo: orderNo, surgeryName, plannedSurgeryDate,
    purpose, validFrom, validTo, frozen, status, settlement,
    createdAt: validFrom + ' 00:00:00', createdBy: '王芳'
  }
}

export const extraAccounts = [
  {
    // 曹秀珍：两笔缴存、只冻结一部分 → 账户「已冻结」但仍有可用余额，演示部分冻结
    accountId: 'A101', patientId: 'P101', totalDeposit: 8000, available: 3000, frozen: 5000,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'FROZEN', settlement: null,
    subOrders: [
      sub('APL20261109104', '膝关节镜下半月板成形术', d(2), '术前检查费用记账', d(-2), d(-1), 5000, 'FROZEN')
    ],
    flows: [
      flow('F1101', dt(-4, 9, 30, 12), 'DEPOSIT', 6000, 6000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1102', dt(-3, 14, 20, 5), 'DEPOSIT', 2000, 8000, '门诊缴存日间手术专项储值金（银行卡）', '王芳'),
      flow('F1103', dt(-2, 9, 15, 40), 'FREEZE', -5000, 3000, '术前检查费用记账，冻结 ¥5,000.00（分单 APL20261109104）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109104', validUntil: d(-1), subOrderNo: 'APL20261109104' })
    ]
  },
  {
    // 徐蔚然：缴存 → 冻结 → 转入住院储值金（当日入院，可撤销入院登记）
    accountId: 'A102', patientId: 'P102', totalDeposit: 9000, available: 0, frozen: 0,
    inpatientDeposit: 9000, consumed: 0, refunded: 0, status: 'TRANSFERRED_IN', settlement: null,
    subOrders: [
      sub('APL20261109105', '肩关节镜下肩峰成形术', d(1), '术前检查费用记账', d(-3), d(-2), 0, 'TRANSFERRED')
    ],
    flows: [
      flow('F1104', dt(-5, 9, 10, 11), 'DEPOSIT', 9000, 9000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1105', dt(-4, 9, 5, 20), 'FREEZE', -9000, 0, '术前检查费用记账，冻结 ¥9,000.00（分单 APL20261109105）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109105', validUntil: d(-2), subOrderNo: 'APL20261109105' }),
      flow('F1106', dt(0, 8, 15), 'TRANSFER_IN', 9000, 0, '入院登记，冻结金额转入住院储值金（分单 APL20261109105）', '陈静', false,
        { purpose: '转住院储值金', applyNo: 'APL20261109105', subOrderNo: 'APL20261109105' })
    ]
  },
  {
    // 严文博：转住院（转科）后的账户，冻结金额已转入住院储值金
    accountId: 'A103', patientId: 'P103', totalDeposit: 7000, available: 0, frozen: 0,
    inpatientDeposit: 7000, consumed: 0, refunded: 0, status: 'TRANSFERRED_IN', settlement: null,
    subOrders: [
      sub('APL20261109106', '骨折内固定取出术', d(-2), '术前检查费用记账', d(-6), d(-5), 0, 'TRANSFERRED')
    ],
    flows: [
      flow('F1107', dt(-6, 10, 5, 1), 'DEPOSIT', 7000, 7000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1108', dt(-5, 9, 30, 12), 'FREEZE', -7000, 0, '术前检查费用记账，冻结 ¥7,000.00（分单 APL20261109106）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109106', validUntil: d(-5), subOrderNo: 'APL20261109106' }),
      flow('F1109', dt(-2, 8, 0, 5), 'TRANSFER_IN', 7000, 0, '入院登记，冻结金额转入住院储值金（分单 APL20261109106）', '陈静', false,
        { purpose: '转住院储值金', applyNo: 'APL20261109106', subOrderNo: 'APL20261109106' })
    ]
  },
  {
    // 汤春燕：转住院已撤销，账户仍保留已转入住院的金额（与代码一致：撤销只回退患者状态）
    accountId: 'A104', patientId: 'P104', totalDeposit: 6000, available: 0, frozen: 0,
    inpatientDeposit: 6000, consumed: 0, refunded: 0, status: 'TRANSFERRED_IN', settlement: null,
    subOrders: [
      sub('APL20261109107', '后路腰椎减压椎间融合术', d(1), '术前检查费用记账', d(-4), d(-3), 0, 'TRANSFERRED')
    ],
    flows: [
      flow('F1110', dt(-5, 14, 20, 33), 'DEPOSIT', 6000, 6000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1111', dt(-4, 10, 0, 12), 'FREEZE', -6000, 0, '术前检查费用记账，冻结 ¥6,000.00（分单 APL20261109107）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109107', validUntil: d(-3), subOrderNo: 'APL20261109107' }),
      flow('F1112', dt(-1, 8, 5, 40), 'TRANSFER_IN', 6000, 0, '入院登记，冻结金额转入住院储值金（分单 APL20261109107）', '陈静', false,
        { purpose: '转住院储值金', applyNo: 'APL20261109107', subOrderNo: 'APL20261109107' })
    ]
  },
  {
    // 钟启明：手工退出日间手术，冻结金额仍在，等收费员「解冻并门诊结算」
    accountId: 'A105', patientId: 'P105', totalDeposit: 5000, available: 0, frozen: 5000,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'FROZEN', settlement: null,
    subOrders: [
      sub('APL20261109108', '腕管切开减压术', d(-2), '术前检查费用记账', d(-4), d(-3), 5000, 'FROZEN')
    ],
    flows: [
      flow('F1113', dt(-4, 10, 30, 12), 'DEPOSIT', 5000, 5000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1114', dt(-3, 9, 20, 5), 'FREEZE', -5000, 0, '术前检查费用记账，冻结 ¥5,000.00（分单 APL20261109108）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109108', validUntil: d(-3), subOrderNo: 'APL20261109108' })
    ]
  },
  {
    // 侯小妮：两次日间手术、2 张分单，评估不通过退出后由收费员分别结算，各出一张门诊结算单
    accountId: 'A106', patientId: 'P106', totalDeposit: 10000, available: 0, frozen: 0,
    inpatientDeposit: 0, consumed: 1520, refunded: 8480, status: 'SETTLED',
    settlement: {
      settlementNo: 'JSM20261106002', at: dt(-3, 16, 12), reason: '麻醉评估不通过',
      note: '麻醉风险评估过高：ASA IV 级，基础疾病控制不佳，不宜日间手术',
      lines: [
        { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
        { name: '心电图检查', amount: 120 }, { name: '患侧关节 MRI 平扫', amount: 400 }
      ],
      total: 960, refund: 4040, applyNo: 'APL20261109109'
    },
    settlements: [
      {
        settlementNo: 'JSM20261104001', at: dt(-13, 17, 40), reason: '患者放弃',
        note: '第一次日间手术术前检查提示需进一步处理，本次未手术',
        lines: [
          { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
          { name: '心电图检查', amount: 120 }
        ],
        total: 560, refund: 4440, applyNo: 'APL20261024033'
      },
      {
        settlementNo: 'JSM20261106002', at: dt(-3, 16, 12), reason: '麻醉评估不通过',
        note: '麻醉风险评估过高：ASA IV 级，基础疾病控制不佳，不宜日间手术',
        lines: [
          { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
          { name: '心电图检查', amount: 120 }, { name: '患侧关节 MRI 平扫', amount: 400 }
        ],
        total: 960, refund: 4040, applyNo: 'APL20261109109'
      }
    ],
    subOrders: [
      sub('APL20261024033', '拇外翻截骨矫形术', d(-14), '术前检查费用记账', d(-16), d(-15), 0, 'SETTLED', {
        settlementNo: 'JSM20261104001', at: dt(-13, 17, 40), reason: '患者放弃',
        note: '第一次日间手术术前检查提示需进一步处理，本次未手术',
        lines: [
          { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
          { name: '心电图检查', amount: 120 }
        ],
        total: 560, refund: 4440, applyNo: 'APL20261024033'
      }),
      sub('APL20261109109', '拇外翻截骨矫形术', d(-3), '术前检查费用记账', d(-6), d(-5), 0, 'SETTLED', {
        settlementNo: 'JSM20261106002', at: dt(-3, 16, 12), reason: '麻醉评估不通过',
        note: '麻醉风险评估过高：ASA IV 级，基础疾病控制不佳，不宜日间手术',
        lines: [
          { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
          { name: '心电图检查', amount: 120 }, { name: '患侧关节 MRI 平扫', amount: 400 }
        ],
        total: 960, refund: 4040, applyNo: 'APL20261109109'
      })
    ],
    flows: [
      flow('F1115', dt(-18, 10, 0, 5), 'DEPOSIT', 10000, 10000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1116', dt(-16, 9, 10, 2), 'FREEZE', -5000, 5000, '术前检查费用记账，冻结 ¥5,000.00（分单 APL20261024033）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261024033', validUntil: d(-15), subOrderNo: 'APL20261024033' }),
      flow('F1117', dt(-5, 9, 15, 33), 'FREEZE', -5000, 0, '术前检查费用记账，冻结 ¥5,000.00（分单 APL20261109109）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109109', validUntil: d(-4), subOrderNo: 'APL20261109109' }),
      flow('F1118', dt(-13, 17, 40, 1), 'OUTPATIENT_CHARGE', -5000, 0, '解冻并门诊结算：扣除已产生费用 ¥560.00，退回 ¥4,440.00（分单 APL20261024033）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261024033', subOrderNo: 'APL20261024033' }),
      flow('F1119', dt(-3, 16, 12, 2), 'OUTPATIENT_CHARGE', -5000, 0, '解冻并门诊结算：扣除已产生费用 ¥960.00，退回 ¥4,040.00（分单 APL20261109109）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109109', subOrderNo: 'APL20261109109' })
    ]
  },
  {
    // 沈云开：报到后取消报到，储值金仍在住院储值金里
    accountId: 'A107', patientId: 'P107', totalDeposit: 6500, available: 0, frozen: 0,
    inpatientDeposit: 6500, consumed: 0, refunded: 0, status: 'TRANSFERRED_IN', settlement: null,
    subOrders: [
      sub('APL20261109110', '膝关节镜下关节清理术', d(0), '术前检查费用记账', d(-5), d(-4), 0, 'TRANSFERRED')
    ],
    flows: [
      flow('F1120', dt(-5, 10, 15, 4), 'DEPOSIT', 6500, 6500, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1121', dt(-4, 9, 40, 8), 'FREEZE', -6500, 0, '术前检查费用记账，冻结 ¥6,500.00（分单 APL20261109110）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109110', validUntil: d(-4), subOrderNo: 'APL20261109110' }),
      flow('F1122', dt(-1, 8, 25, 3), 'TRANSFER_IN', 6500, 0, '入院登记，冻结金额转入住院储值金（分单 APL20261109110）', '陈静', false,
        { purpose: '转住院储值金', applyNo: 'APL20261109110', subOrderNo: 'APL20261109110' })
    ]
  },
  {
    // 万家骏：专科评估不通过自动退出，冻结金额未结算（等收费员处理）
    accountId: 'A108', patientId: 'P108', totalDeposit: 4800, available: 0, frozen: 4800,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'FROZEN', settlement: null,
    subOrders: [
      sub('APL20261109111', '经皮椎体成形术（PKP）', d(-1), '术前检查费用记账', d(-4), d(-3), 4800, 'FROZEN')
    ],
    flows: [
      flow('F1123', dt(-4, 11, 0, 18), 'DEPOSIT', 4800, 4800, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1124', dt(-3, 9, 30, 44), 'FREEZE', -4800, 0, '术前检查费用记账，冻结 ¥4,800.00（分单 APL20261109111）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109111', validUntil: d(-3), subOrderNo: 'APL20261109111' })
    ]
  },
  {
    // 顾爱民：一笔缴存被冲正（灰显划线 + 负数流水），可看「已冲正」状态
    accountId: 'A109', patientId: 'P109', totalDeposit: 6000, available: 6000, frozen: 0,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'NORMAL', settlement: null,
    subOrders: [],
    flows: [
      flow('F1125', dt(-5, 9, 30, 12), 'DEPOSIT', 6000, 6000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1126', dt(-4, 10, 15, 33), 'DEPOSIT', 2000, 8000, '门诊缴存日间手术专项储值金（扫码）', '王芳', true, { voidReason: '金额录入错误' }),
      flow('F1127', dt(-3, 9, 5, 18), 'REVERSE', -2000, 6000, '冲正：金额录入错误（原流水 F1126）', '王芳', false,
        { purpose: '金额录入错误' })
    ]
  },
  {
    // 龙玉兰：手术完成当日离院，住院储值金留存
    accountId: 'A110', patientId: 'P110', totalDeposit: 5500, available: 0, frozen: 0,
    inpatientDeposit: 5500, consumed: 0, refunded: 0, status: 'TRANSFERRED_IN', settlement: null,
    subOrders: [
      sub('APL20261109113', '拇外翻截骨矫形术', d(-6), '术前检查费用记账', d(-9), d(-8), 0, 'TRANSFERRED')
    ],
    flows: [
      flow('F1128', dt(-8, 9, 30, 10), 'DEPOSIT', 5500, 5500, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1129', dt(-7, 9, 40, 22), 'FREEZE', -5500, 0, '术前检查费用记账，冻结 ¥5,500.00（分单 APL20261109113）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109113', validUntil: d(-8), subOrderNo: 'APL20261109113' }),
      flow('F1130', dt(-6, 7, 45, 1), 'TRANSFER_IN', 5500, 0, '入院登记，冻结金额转入住院储值金（分单 APL20261109113）', '陈静', false,
        { purpose: '转住院储值金', applyNo: 'APL20261109113', subOrderNo: 'APL20261109113' })
    ]
  },
  {
    // 蒲一鸣：费用单作废后重新录入，储值金已转入住院
    accountId: 'A111', patientId: 'P111', totalDeposit: 7500, available: 0, frozen: 0,
    inpatientDeposit: 7500, consumed: 0, refunded: 0, status: 'TRANSFERRED_IN', settlement: null,
    subOrders: [
      sub('APL20261109114', '膝关节镜下半月板成形术', d(1), '术前检查费用记账', d(-5), d(-4), 0, 'TRANSFERRED')
    ],
    flows: [
      flow('F1131', dt(-5, 9, 15, 7), 'DEPOSIT', 7500, 7500, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1132', dt(-4, 9, 50, 33), 'FREEZE', -7500, 0, '术前检查费用记账，冻结 ¥7,500.00（分单 APL20261109114）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109114', validUntil: d(-4), subOrderNo: 'APL20261109114' }),
      flow('F1133', dt(-1, 8, 50, 12), 'TRANSFER_IN', 7500, 0, '入院登记，冻结金额转入住院储值金（分单 APL20261109114）', '陈静', false,
        { purpose: '转住院储值金', applyNo: 'APL20261109114', subOrderNo: 'APL20261109114' })
    ]
  },
  {
    // 白玉兰：评估不通过自动退出，冻结金额未结算
    accountId: 'A112', patientId: 'P112', totalDeposit: 6000, available: 0, frozen: 6000,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'FROZEN', settlement: null,
    subOrders: [
      sub('APL20261109115', '经皮椎间孔镜下髓核摘除术', d(-2), '术前检查费用记账', d(-5), d(-4), 6000, 'FROZEN')
    ],
    flows: [
      flow('F1134', dt(-5, 10, 20, 15), 'DEPOSIT', 6000, 6000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1135', dt(-4, 9, 30, 44), 'FREEZE', -6000, 0, '术前检查费用记账，冻结 ¥6,000.00（分单 APL20261109115）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109115', validUntil: d(-4), subOrderNo: 'APL20261109115' })
    ]
  },
  {
    // 温书瑶：已缴存未冻结（术前评估还没做完）
    accountId: 'A113', patientId: 'P113', totalDeposit: 5000, available: 5000, frozen: 0,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'NORMAL', settlement: null,
    subOrders: [],
    flows: [flow('F1136', dt(-2, 9, 30, 12), 'DEPOSIT', 5000, 5000, '门诊缴存日间手术专项储值金', '王芳')]
  },
  {
    // 戚文轩：专科评估通过后已冻结（等麻醉评估结论）
    accountId: 'A114', patientId: 'P114', totalDeposit: 6000, available: 0, frozen: 6000,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'FROZEN', settlement: null,
    subOrders: [
      sub('APL20261109117', '腕管切开减压术', d(3), '术前检查费用记账', d(-4), d(-3), 6000, 'FROZEN')
    ],
    flows: [
      flow('F1137', dt(-4, 9, 0, 20), 'DEPOSIT', 6000, 6000, '门诊缴存日间手术专项储值金', '王芳'),
      flow('F1138', dt(-3, 9, 40, 5), 'FREEZE', -6000, 0, '术前检查费用记账，冻结 ¥6,000.00（分单 APL20261109117）', '王芳', false,
        { purpose: '术前检查费用记账', applyNo: 'APL20261109117', validUntil: d(-3), subOrderNo: 'APL20261109117' })
    ]
  },
  {
    // 蓝月华：已缴存未冻结，检查报告尚未回传
    accountId: 'A115', patientId: 'P115', totalDeposit: 6800, available: 6800, frozen: 0,
    inpatientDeposit: 0, consumed: 0, refunded: 0, status: 'NORMAL', settlement: null,
    subOrders: [],
    flows: [flow('F1139', dt(-1, 15, 20, 44), 'DEPOSIT', 6800, 6800, '门诊缴存日间手术专项储值金', '王芳')]
  }
]

/* ---------------- 补充演示申请单 ----------------
 * APL101 / APL102：抗凝停药已满 7 天与恰好 7 天 → 「建档」按钮由红叉变绿
 * APL103：业务模式「麻醉不手术」
 * APL104 起：已建档，供储值金冻结关联申请单号使用
 */
const applyBase = { status: 'ARCHIVED', removed: false, returnReason: '', returnNote: '', returnAt: '', returnBy: '' }

export const extraApplies = [
  {
    ...applyBase, applyId: 'APL101', applyNo: 'APL20261109101', patientId: '', patientName: '郭大勇',
    gender: '男', age: 71, inpatientNo: 'D2026116', bizMode: '手术麻醉',
    surgeryName: '经皮椎体成形术（PKP）', surgeryCode: '81.6500', plannedSurgeryDate: d(6),
    surgeon: '李伟', antiCoagulant: true, antiCoagStopDate: d(-10), applyDept: '脊柱外科门诊',
    diagnosis: '腰 5 椎体骨质疏松性压缩骨折', applyDoctor: '李伟', applyTime: dt(-2, 10, 15),
    note: '长期口服阿司匹林，已停药 10 天，符合日间手术准入', status: 'PENDING'
  },
  {
    ...applyBase, applyId: 'APL102', applyNo: 'APL20261109102', patientId: '', patientName: '傅明玉',
    gender: '女', age: 56, inpatientNo: 'D2026117', bizMode: '手术不麻醉',
    surgeryName: '腱鞘囊肿切除术', surgeryCode: '82.2900', plannedSurgeryDate: d(2),
    surgeon: '周立', antiCoagulant: true, antiCoagStopDate: d(-7), applyDept: '手外科门诊',
    diagnosis: '右腕背腱鞘囊肿', applyDoctor: '周立', applyTime: dt(-1, 9, 40),
    note: '口服华法林，恰好停药 7 天（临界值）', status: 'PENDING'
  },
  {
    ...applyBase, applyId: 'APL103', applyNo: 'APL20261109103', patientId: '', patientName: '崔雅琴',
    gender: '女', age: 45, inpatientNo: 'D2026118', bizMode: '麻醉不手术',
    surgeryName: '麻醉下肩关节腔穿刺注射治疗', surgeryCode: '81.9200', plannedSurgeryDate: d(4),
    surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '运动医学科门诊',
    diagnosis: '右肩关节粘连性关节囊炎（冻结肩）', applyDoctor: '周立', applyTime: dt(-1, 14, 5),
    note: '仅行麻醉下穿刺治疗，不做手术', status: 'PENDING'
  },
  {
    ...applyBase, applyId: 'APL104', applyNo: 'APL20261109104', patientId: 'P101', patientName: '曹秀珍',
    gender: '女', age: 52, inpatientNo: 'D2026101', bizMode: '手术麻醉',
    surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001', plannedSurgeryDate: d(2),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '关节外科门诊',
    diagnosis: '右膝内侧半月板损伤（Ⅱ级）', applyDoctor: '张海涛', applyTime: dt(-4, 9, 30), note: ''
  },
  {
    ...applyBase, applyId: 'APL105', applyNo: 'APL20261109105', patientId: 'P102', patientName: '徐蔚然',
    gender: '女', age: 34, inpatientNo: 'D2026102', bizMode: '手术麻醉',
    surgeryName: '肩关节镜下肩峰成形术', surgeryCode: '81.8300', plannedSurgeryDate: d(1),
    surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '运动医学科门诊',
    diagnosis: '右肩峰下撞击综合征', applyDoctor: '周立', applyTime: dt(-5, 9, 10), note: ''
  },
  {
    ...applyBase, applyId: 'APL106', applyNo: 'APL20261109106', patientId: 'P103', patientName: '严文博',
    gender: '男', age: 58, inpatientNo: 'D2026103', bizMode: '手术麻醉',
    surgeryName: '骨折内固定取出术', surgeryCode: '78.6300', plannedSurgeryDate: d(-2),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '创伤骨科门诊',
    diagnosis: '左胫骨骨折术后（内固定存留）', applyDoctor: '张海涛', applyTime: dt(-6, 10, 5), note: ''
  },
  {
    ...applyBase, applyId: 'APL107', applyNo: 'APL20261109107', patientId: 'P104', patientName: '汤春燕',
    gender: '女', age: 45, inpatientNo: 'D2026104', bizMode: '手术麻醉',
    surgeryName: '后路腰椎减压椎间融合术', surgeryCode: '81.0800', plannedSurgeryDate: d(1),
    surgeon: '李伟', antiCoagulant: false, antiCoagStopDate: '', applyDept: '脊柱外科门诊',
    diagnosis: '腰 4/5 椎管狭窄症', applyDoctor: '李伟', applyTime: dt(-5, 14, 20), note: ''
  },
  {
    ...applyBase, applyId: 'APL108', applyNo: 'APL20261109108', patientId: 'P105', patientName: '钟启明',
    gender: '男', age: 43, inpatientNo: 'D2026105', bizMode: '手术不麻醉',
    surgeryName: '腕管切开减压术', surgeryCode: '04.4300', plannedSurgeryDate: d(-2),
    surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '手外科门诊',
    diagnosis: '左腕管综合征（中度）', applyDoctor: '周立', applyTime: dt(-4, 10, 30), note: ''
  },
  {
    ...applyBase, applyId: 'APL109', applyNo: 'APL20261109109', patientId: 'P106', patientName: '侯小妮',
    gender: '女', age: 41, inpatientNo: 'D2026106', bizMode: '手术麻醉',
    surgeryName: '拇外翻截骨矫形术', surgeryCode: '77.5100', plannedSurgeryDate: d(-3),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '足踝外科门诊',
    diagnosis: '左足踇外翻（中度）', applyDoctor: '张海涛', applyTime: dt(-7, 10, 0), note: ''
  },
  {
    ...applyBase, applyId: 'APL110', applyNo: 'APL20261109110', patientId: 'P107', patientName: '沈云开',
    gender: '男', age: 36, inpatientNo: 'D2026107', bizMode: '手术麻醉',
    surgeryName: '膝关节镜下关节清理术', surgeryCode: '80.8600', plannedSurgeryDate: d(0),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '关节外科门诊',
    diagnosis: '左膝关节游离体', applyDoctor: '张海涛', applyTime: dt(-5, 10, 15), note: ''
  },
  {
    ...applyBase, applyId: 'APL111', applyNo: 'APL20261109111', patientId: 'P108', patientName: '万家骏',
    gender: '男', age: 66, inpatientNo: 'D2026108', bizMode: '手术麻醉',
    surgeryName: '经皮椎体成形术（PKP）', surgeryCode: '81.6500', plannedSurgeryDate: d(-1),
    surgeon: '李伟', antiCoagulant: false, antiCoagStopDate: '', applyDept: '脊柱外科门诊',
    diagnosis: '腰 3 椎体骨质疏松性压缩骨折', applyDoctor: '李伟', applyTime: dt(-4, 11, 0), note: ''
  },
  {
    ...applyBase, applyId: 'APL112', applyNo: 'APL20261109112', patientId: 'P109', patientName: '顾爱民',
    gender: '男', age: 49, inpatientNo: 'D2026109', bizMode: '手术麻醉',
    surgeryName: '骨折内固定取出术', surgeryCode: '78.6300', plannedSurgeryDate: d(-1),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '创伤骨科门诊',
    diagnosis: '右尺骨骨折术后（内固定存留）', applyDoctor: '张海涛', applyTime: dt(-5, 9, 30), note: ''
  },
  {
    ...applyBase, applyId: 'APL113', applyNo: 'APL20261109113', patientId: 'P110', patientName: '龙玉兰',
    gender: '女', age: 66, inpatientNo: 'D2026110', bizMode: '手术麻醉',
    surgeryName: '拇外翻截骨矫形术', surgeryCode: '77.5100', plannedSurgeryDate: d(-6),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '足踝外科门诊',
    diagnosis: '右足踇外翻（中重度）', applyDoctor: '张海涛', applyTime: dt(-8, 9, 30), note: ''
  },
  {
    ...applyBase, applyId: 'APL114', applyNo: 'APL20261109114', patientId: 'P111', patientName: '蒲一鸣',
    gender: '男', age: 39, inpatientNo: 'D2026111', bizMode: '手术麻醉',
    surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001', plannedSurgeryDate: d(1),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '关节外科门诊',
    diagnosis: '左膝内侧半月板损伤（Ⅲ级）', applyDoctor: '张海涛', applyTime: dt(-5, 9, 15), note: ''
  },
  {
    ...applyBase, applyId: 'APL115', applyNo: 'APL20261109115', patientId: 'P112', patientName: '白玉兰',
    gender: '女', age: 55, inpatientNo: 'D2026112', bizMode: '手术麻醉',
    surgeryName: '经皮椎间孔镜下髓核摘除术', surgeryCode: '80.5100', plannedSurgeryDate: d(-2),
    surgeon: '李伟', antiCoagulant: false, antiCoagStopDate: '', applyDept: '脊柱外科门诊',
    diagnosis: '腰 4/5 椎间盘突出症（双侧）', applyDoctor: '李伟', applyTime: dt(-5, 10, 20), note: ''
  },
  {
    ...applyBase, applyId: 'APL116', applyNo: 'APL20261109116', patientId: 'P113', patientName: '温书瑶',
    gender: '女', age: 30, inpatientNo: 'D2026113', bizMode: '手术麻醉',
    surgeryName: '肩关节镜下肩峰成形术', surgeryCode: '81.8300', plannedSurgeryDate: d(4),
    surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '运动医学科门诊',
    diagnosis: '左肩峰下撞击综合征', applyDoctor: '周立', applyTime: dt(-2, 9, 30), note: ''
  },
  {
    ...applyBase, applyId: 'APL117', applyNo: 'APL20261109117', patientId: 'P114', patientName: '戚文轩',
    gender: '男', age: 50, inpatientNo: 'D2026114', bizMode: '手术不麻醉',
    surgeryName: '腕管切开减压术', surgeryCode: '04.4300', plannedSurgeryDate: d(3),
    surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '手外科门诊',
    diagnosis: '右腕管综合征（轻度）', applyDoctor: '周立', applyTime: dt(-4, 9, 0), note: ''
  },
  {
    ...applyBase, applyId: 'APL118', applyNo: 'APL20261109118', patientId: 'P115', patientName: '蓝月华',
    gender: '女', age: 28, inpatientNo: 'D2026115', bizMode: '手术麻醉',
    surgeryName: '骨折内固定取出术', surgeryCode: '78.6300', plannedSurgeryDate: d(5),
    surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '创伤骨科门诊',
    diagnosis: '右锁骨骨折术后（内固定存留）', applyDoctor: '张海涛', applyTime: dt(-1, 15, 20), note: ''
  }
]

/* ---------------- 补充 HIS 待接收池 ----------------
 * 陆国栋：抗凝停药已满 12 天 → 接收后可直接建档
 * 汪丽萍：业务模式「麻醉不手术」
 */
export const extraApplyPool = [
  {
    applyNo: 'APL20261109119', patientName: '陆国栋', gender: '男', age: 58, inpatientNo: 'D2026119',
    bizMode: '手术麻醉', surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001',
    plannedSurgeryDate: d(7), surgeon: '张海涛', antiCoagulant: true, antiCoagStopDate: d(-12),
    applyDept: '关节外科门诊', applyDoctor: '张海涛', applyTime: dt(0, 9, 5),
    diagnosis: '右膝内侧半月板损伤（Ⅱ级）',
    idCard: '5101**********1919', phone: '138****1190'
  },
  {
    applyNo: 'APL20261109120', patientName: '汪丽萍', gender: '女', age: 33, inpatientNo: 'D2026120',
    bizMode: '麻醉不手术', surgeryName: '麻醉下腰神经阻滞术', surgeryCode: '81.9200',
    plannedSurgeryDate: d(6), surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '',
    applyDept: '疼痛科门诊', applyDoctor: '周立', applyTime: dt(0, 10, 30),
    diagnosis: '腰 4/5 椎间盘突出症（保守治疗无效）',
    idCard: '5101**********1920', phone: '139****1201'
  }
]

/* ---------------- 补充演示评估记录 ---------------- */
const evalBase = { reason: '', reasonNote: '', asa: '', anesthesiaMethod: '', riskNote: '', voided: false }

export const extraEvals = [
  { ...evalBase, evalId: 'EVL101', patientId: 'P101', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-3, 9, 20) },
  {
    ...evalBase, evalId: 'EVL102', patientId: 'P101', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '轻度贫血，术中备输血，术后镇痛泵',
    doctor: '罗建平', time: dt(-3, 10, 5)
  },
  { ...evalBase, evalId: 'EVL103', patientId: 'P102', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '周立', time: dt(-4, 9, 30) },
  {
    ...evalBase, evalId: 'EVL104', patientId: 'P102', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA III', anesthesiaMethod: '全身麻醉',
    riskNote: 'ASA Ⅲ 级：合并 2 型糖尿病与高血压，胰岛素泵调控血糖，术中严密监测血压波动',
    doctor: '罗建平', time: dt(-4, 10, 15)
  },
  { ...evalBase, evalId: 'EVL105', patientId: 'P103', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-5, 9, 10) },
  {
    ...evalBase, evalId: 'EVL106', patientId: 'P103', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA II', anesthesiaMethod: '椎管内麻醉', riskNote: '腰穿困难，备全麻转管',
    doctor: '罗建平', time: dt(-5, 9, 50)
  },
  { ...evalBase, evalId: 'EVL107', patientId: 'P104', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '李伟', time: dt(-4, 9, 40) },
  {
    ...evalBase, evalId: 'EVL108', patientId: 'P104', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '长期口服糖皮质激素，术中预防性补液',
    doctor: '罗建平', time: dt(-4, 10, 20)
  },
  { ...evalBase, evalId: 'EVL109', patientId: 'P105', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '周立', time: dt(-3, 9, 10) },
  { ...evalBase, evalId: 'EVL110', patientId: 'P106', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-4, 9, 50) },
  {
    ...evalBase, evalId: 'EVL111', patientId: 'P106', type: 'ANESTHESIA', conclusion: 'FAILED',
    reason: '麻醉风险评估过高', reasonNote: 'ASA IV 级，合并慢性阻塞性肺疾病与心功能不全，不宜日间手术',
    doctor: '罗建平', time: dt(-3, 15, 50)
  },
  { ...evalBase, evalId: 'EVL112', patientId: 'P107', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-4, 9, 30) },
  {
    ...evalBase, evalId: 'EVL113', patientId: 'P107', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA I', anesthesiaMethod: '局部浸润麻醉', riskNote: '局部浸润麻醉，无需禁食',
    doctor: '罗建平', time: dt(-4, 10, 0)
  },
  {
    ...evalBase, evalId: 'EVL114', patientId: 'P108', type: 'SPECIALIST', conclusion: 'FAILED',
    reason: '其他', reasonNote: '术前访视发现牙周活动性感染灶，需抗感染治疗后再评估',
    doctor: '张海涛', time: dt(-1, 9, 40)
  },
  { ...evalBase, evalId: 'EVL115', patientId: 'P109', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-4, 9, 10) },
  {
    ...evalBase, evalId: 'EVL116', patientId: 'P109', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '高血压病史，术中控制性降压',
    doctor: '罗建平', time: dt(-4, 9, 40)
  },
  { ...evalBase, evalId: 'EVL117', patientId: 'P110', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-7, 9, 20) },
  {
    ...evalBase, evalId: 'EVL118', patientId: 'P110', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '老年患者，术中保温，术后早期下床',
    doctor: '罗建平', time: dt(-7, 10, 0)
  },
  { ...evalBase, evalId: 'EVL119', patientId: 'P111', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-4, 9, 30) },
  {
    ...evalBase, evalId: 'EVL120', patientId: 'P111', type: 'ANESTHESIA', conclusion: 'PASSED',
    asa: 'ASA I', anesthesiaMethod: '局部浸润麻醉', riskNote: '局麻+镇静，术中唤醒确认下肢肌力',
    doctor: '罗建平', time: dt(-4, 10, 10)
  },
  {
    ...evalBase, evalId: 'EVL121', patientId: 'P112', type: 'SPECIALIST', conclusion: 'FAILED',
    reason: '血糖控制不佳', reasonNote: '空腹血糖 13.2mmol/L，糖化血红蛋白 9.8%，暂不宜手术',
    doctor: '李伟', time: dt(-2, 10, 15)
  },
  { ...evalBase, evalId: 'EVL122', patientId: 'P114', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '周立', time: dt(-1, 10, 30) }
]

/* ---------------- 补充演示排程 ----------------
 * 覆盖：已报到（CHECKED_IN）、已取消（CANCELLED）、预约与实际安排不一致（CHANGED）
 * 今日排台刻意留出「日间 1 间 第 1 台」空位，供主演示新建预约
 */
export const extraSchedules = [
  {
    // 王建军：已报到，排程状态置为「已报到」
    scheduleId: 'SCH00000101', patientId: 'P005', surgeryDate: d(0), room: '日间 2 间', seq: 1,
    surgeon: '周立', anesthesiologist: '罗建平', anesthesiaType: '局部浸润麻醉', status: 'CHECKED_IN',
    bookedDate: d(0), bookedRoom: '日间 2 间', bookedSeq: 1, bookedSurgeon: '周立',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  },
  {
    // 沈云开：今日排程，报到后又被撤回 → 排程回到「已预约」
    scheduleId: 'SCH00000102', patientId: 'P107', surgeryDate: d(0), room: '日间 1 间', seq: 2,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '局部浸润麻醉', status: 'SCHEDULED',
    bookedDate: d(0), bookedRoom: '日间 1 间', bookedSeq: 2, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  },
  {
    // 徐蔚然：明日排程（今日入院、明日手术，与「入院前一日入院」的模板口径一致）
    scheduleId: 'SCH00000103', patientId: 'P102', surgeryDate: d(1), room: '日间 1 间', seq: 2,
    surgeon: '周立', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'SCHEDULED',
    bookedDate: d(1), bookedRoom: '日间 1 间', bookedSeq: 2, bookedSurgeon: '周立',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  },
  {
    // 汤春燕：预约后调整了手术间 → 预约与实际安排不一致（差异黄条）
    scheduleId: 'SCH00000104', patientId: 'P104', surgeryDate: d(1), room: '日间 2 间', seq: 1,
    surgeon: '李伟', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'CHANGED',
    bookedDate: d(1), bookedRoom: '日间 1 间', bookedSeq: 1, bookedSurgeon: '李伟',
    isChanged: true, changeCount: 1,
    changeLogs: [
      { time: dt(-1, 15, 20), operator: '陈静', reason: '手术室临时调整', text: `${d(1)} 日间 1 间 第 1 台 → ${d(1)} 日间 2 间 第 1 台` }
    ],
    cancelReason: ''
  },
  {
    // 蒲一鸣：明日排程
    scheduleId: 'SCH00000105', patientId: 'P111', surgeryDate: d(1), room: '日间 3 间', seq: 1,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '椎管内麻醉', status: 'SCHEDULED',
    bookedDate: d(1), bookedRoom: '日间 3 间', bookedSeq: 1, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  },
  {
    // 曹秀珍：预约后调整了手术间 → 预约与实际安排不一致
    scheduleId: 'SCH00000106', patientId: 'P101', surgeryDate: d(2), room: '日间 2 间', seq: 1,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'CHANGED',
    bookedDate: d(2), bookedRoom: '日间 1 间', bookedSeq: 1, bookedSurgeon: '张海涛',
    isChanged: true, changeCount: 1,
    changeLogs: [
      { time: dt(-1, 16, 40), operator: '陈静', reason: '手术室临时调整', text: `${d(2)} 日间 1 间 第 1 台 → ${d(2)} 日间 2 间 第 1 台` }
    ],
    cancelReason: ''
  },
  {
    // 严文博：静脉麻醉的历史台次（手术查询页「麻醉方式」筛选项的第 5 种）
    scheduleId: 'SCH00000107', patientId: 'P103', surgeryDate: d(-2), room: '日间 3 间', seq: 2,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '静脉麻醉', status: 'COMPLETED',
    bookedDate: d(-2), bookedRoom: '日间 3 间', bookedSeq: 2, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  },
  {
    // 侯小妮：第一次日间手术的台次（评估需复评 → 预约取消，对应第一张分单）
    scheduleId: 'SCH00000108', patientId: 'P106', surgeryDate: d(-14), room: '日间 1 间', seq: 2,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '椎管内麻醉', status: 'CANCELLED',
    bookedDate: d(-14), bookedRoom: '日间 1 间', bookedSeq: 2, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: '评估需复评'
  },
  {
    // 钟启明：患者放弃手术，预约取消 → 患者回到「术前准备」
    scheduleId: 'SCH00000109', patientId: 'P105', surgeryDate: d(-2), room: '日间 2 间', seq: 1,
    surgeon: '周立', anesthesiologist: '罗建平', anesthesiaType: '局部浸润麻醉', status: 'CANCELLED',
    bookedDate: d(-2), bookedRoom: '日间 2 间', bookedSeq: 1, bookedSurgeon: '周立',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: '患者放弃手术'
  },
  {
    // 顾爱民：手术室资源调整，预约取消
    scheduleId: 'SCH00000110', patientId: 'P109', surgeryDate: d(-1), room: '日间 2 间', seq: 2,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'CANCELLED',
    bookedDate: d(-1), bookedRoom: '日间 2 间', bookedSeq: 2, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: '手术室资源调整'
  },
  {
    // 龙玉兰：手术完成的历史台次（对应「已出院」患者）
    scheduleId: 'SCH00000111', patientId: 'P110', surgeryDate: d(-6), room: '日间 1 间', seq: 1,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'COMPLETED',
    bookedDate: d(-6), bookedRoom: '日间 1 间', bookedSeq: 1, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  },
  {
    // 孙丽：手术完成的历史台次（对应初始种子里的既往报到记录）
    scheduleId: 'SCH00000112', patientId: 'P006', surgeryDate: d(-5), room: '日间 2 间', seq: 1,
    surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'COMPLETED',
    bookedDate: d(-5), bookedRoom: '日间 2 间', bookedSeq: 1, bookedSurgeon: '张海涛',
    isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
  }
]

/* ---------------- 补充演示报到记录 ---------------- */
function guards(scheduleText, depositText, evalText) {
  return [
    { key: 'schedule', label: '手术预约', ok: true, detail: scheduleText },
    { key: 'date', label: '手术日期', ok: true, detail: '手术日期为当日' },
    { key: 'eval', label: '术前评估', ok: true, detail: evalText },
    { key: 'deposit', label: '储值金', ok: true, detail: depositText }
  ]
}

export const extraCheckins = [
  {
    // 沈云开：报到后临时改期，撤回本次报到 → 患者回到「已入院」，排程回到「已预约」
    checkInId: 'CIR000101', patientId: 'P107', scheduleId: 'SCH00000102',
    checkInTime: dt(0, 7, 40), checkInMethod: '刷医保卡', checkInBy: '陈静',
    guardsSnapshot: guards('已预约 ' + d(0) + ' 日间 1 间 第 2 台', '储值金已转入住院 ¥6,500.00', '专科与麻醉评估均通过'),
    printConsent: false, printTime: '', voided: true, voidReason: '患者临时改期，撤回本次报到'
  },
  {
    // 严文博：既往报到记录（刷身份证）
    checkInId: 'CIR000102', patientId: 'P103', scheduleId: 'SCH00000107',
    checkInTime: dt(-2, 7, 50), checkInMethod: '刷身份证', checkInBy: '陈静',
    guardsSnapshot: guards('已预约 ' + d(-2) + ' 日间 3 间 第 2 台', '储值金已转入住院 ¥7,000.00', '专科与麻醉评估均通过'),
    printConsent: true, printTime: dt(-2, 7, 58), voided: false, voidReason: ''
  },
  {
    // 蒲一鸣：既往报到记录（扫申请单条码）
    checkInId: 'CIR000103', patientId: 'P111', scheduleId: '',
    checkInTime: dt(-20, 8, 5), checkInMethod: '扫申请单条码', checkInBy: '陈静',
    guardsSnapshot: guards('已预约 ' + d(-20) + ' 日间 3 间 第 1 台', '储值金已转入住院 ¥7,500.00', '专科与麻醉评估均通过'),
    printConsent: true, printTime: dt(-20, 8, 12), voided: false, voidReason: ''
  }
]

/* ---------------- 补充演示通知 ----------------
 * 覆盖：类型「取消通知」、状态「已作废」、渠道「短信 + 电话」、失败待重发、重发成功
 */
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六']
const wd = (date) => '周' + WEEK_CN[new Date(String(date).slice(0, 10) + 'T00:00:00').getDay()]
const tip = '术前 8 小时禁食、4 小时禁饮；请提前取下义齿与饰品，术晨勿化妆，并携带患肢 X 线 / MRI 影像资料。'

export const extraMessages = [
  {
    msgId: 'MSG101', patientId: 'P102', type: 'APPOINTMENT_SUCCESS', tplKey: 'APPOINTMENT_SUCCESS',
    channel: '短信', phone: '137****3312', status: 'FAILED',
    planSendTime: dt(-4, 9, 15), sendTime: '', smsCount: 3,
    resendCount: 0, failReason: '网关返回：短信通道拥塞，请稍后重试',
    trigger: '创建手术预约 SCH00000103', content:
      '【四川省骨科医院】徐蔚然您好，您的手术已预约成功。\n' +
      '手术日期：' + d(1) + '（' + wd(d(1)) + '）\n' +
      '手术安排：日间 1 间 第 2 台\n' +
      '手术科室：运动医学科 · 主刀：周立\n' +
      '麻醉方式：全身麻醉\n' +
      '请于手术当日 07:30 前到日间手术中心办理入院，' + tip + '请携带身份证、医保卡与住院证。如需改期请致电 028-8888 6120。'
  },
  {
    msgId: 'MSG102', patientId: 'P111', type: 'APPOINTMENT_SUCCESS', tplKey: 'APPOINTMENT_SUCCESS',
    channel: '短信', phone: '135****9901', status: 'SENT',
    planSendTime: dt(-4, 9, 15), sendTime: dt(-4, 9, 15, 18), smsCount: 3,
    resendCount: 1, trigger: '创建手术预约 SCH00000105', content:
      '【四川省骨科医院】蒲一鸣您好，您的手术已预约成功。\n' +
      '手术日期：' + d(1) + '（' + wd(d(1)) + '）\n' +
      '手术安排：日间 3 间 第 1 台\n' +
      '手术科室：关节外科 · 主刀：张海涛\n' +
      '麻醉方式：椎管内麻醉\n' +
      '请于手术当日 07:30 前到日间手术中心办理入院，' + tip + '请携带身份证、医保卡与住院证。如需改期请致电 028-8888 6120。'
  },
  {
    msgId: 'MSG103', patientId: 'P104', type: 'SCHEDULE_CHANGE', tplKey: 'SCHEDULE_CHANGE',
    channel: '短信 + 电话', phone: '136****4477', status: 'SENT',
    planSendTime: dt(-1, 15, 20), sendTime: dt(-1, 15, 20, 35), smsCount: 2,
    resendCount: 0, trigger: '调整手术安排 SCH00000104', content:
      '【四川省骨科医院】汤春燕您好，您的手术时间已调整：\n' +
      '原定 ' + d(1) + '（' + wd(d(1)) + '）日间 1 间 第 1 台，\n' +
      '调整为 ' + d(1) + '（' + wd(d(1)) + '）日间 2 间 第 1 台，主刀 李伟。\n' +
      '请按新时间到院，' + tip
  },
  {
    msgId: 'MSG104', patientId: 'P109', type: 'CANCEL', tplKey: 'CANCEL',
    channel: '短信', phone: '138****2299', status: 'SENT',
    planSendTime: dt(-1, 11, 10), sendTime: dt(-1, 11, 10, 22), smsCount: 1,
    resendCount: 0, trigger: '取消手术预约 SCH00000110', content:
      '【日间手术中心】顾爱民您好，您的手术预约已取消。原因：手术室资源调整。' +
      '如需重新预约请与日间手术中心联系，电话 028-8888 6120。'
  },
  {
    msgId: 'MSG105', patientId: 'P109', type: 'PRE_ADMISSION', tplKey: 'PRE_ADMISSION',
    channel: '短信', phone: '138****2299', status: 'VOIDED',
    planSendTime: dt(-2, 9, 0), sendTime: '', smsCount: 3,
    resendCount: 0, trigger: '入院前提醒（提前 1 天）', content:
      '【四川省骨科医院】顾爱民您好，您预约的手术时间为 ' + d(-1) + '（' + wd(d(-1)) + '）日间 2 间 第 2 台。\n' +
      '请于手术前一日 14:00 前到日间手术中心办理入院并完成术前准备（本短信在术前 1 天发送）。\n' +
      tip + '请携带身份证、医保卡与住院证。'
  },
  {
    msgId: 'MSG106', patientId: 'P102', type: 'PRE_ADMISSION', tplKey: 'PRE_ADMISSION',
    channel: '短信', phone: '137****3312', status: 'PENDING',
    planSendTime: dt(0, 9, 0), sendTime: '', smsCount: 3,
    resendCount: 0, trigger: '入院前提醒（提前 1 天）', content:
      '【四川省骨科医院】徐蔚然您好，您预约的手术时间为 ' + d(1) + '（' + wd(d(1)) + '）日间 1 间 第 2 台。\n' +
      '请于手术前一日 14:00 前到日间手术中心办理入院并完成术前准备（本短信在术前 1 天发送）。\n' +
      tip + '请携带身份证、医保卡与住院证。'
  }
]

/* ---------------- 补充演示费用单 ----------------
 * 覆盖：已作废、重新录入后的编辑中草稿（含已移除明细）、另一名患者的已提交单
 */
export const extraCharges = [
  {
    // 蒲一鸣：整单作废（原因 + 时间），明细灰显划线保留
    chargeId: 'CJ20261104001', patientId: 'P111', status: 'VOIDED', groupName: '膝关节镜常用组套',
    lines: [
      { chargeItemId: 'FI0101', code: '310101', name: '膝关节镜下半月板成形术', spec: '次', unit: '次', qty: 1, price: 3200, amount: 3200, removed: false },
      { chargeItemId: 'FI0102', code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 800, amount: 800, removed: false },
      { chargeItemId: 'FI0103', code: '310301', name: '一次性使用关节镜刨削刀头', spec: '4.0mm', unit: '个', qty: 1, price: 260, amount: 260, removed: false },
      { chargeItemId: 'FI0104', code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 1, price: 100, amount: 100, removed: false }
    ],
    total: 4360, submittedAt: dt(-1, 11, 40), submittedBy: '张海涛',
    voidReason: '组套选错', voidedAt: dt(-1, 15, 20),
    createdAt: dt(-1, 11, 30), createdBy: '张海涛'
  },
  {
    // 蒲一鸣：基于已作废单重新录入的新草稿，其中一条明细被移除（灰显可恢复）
    chargeId: 'CJ20261104002', patientId: 'P111', status: 'DRAFT', groupName: '膝关节镜常用组套',
    lines: [
      { chargeItemId: 'FI0105', code: '310101', name: '膝关节镜下半月板成形术', spec: '次', unit: '次', qty: 1, price: 3200, amount: 3200, removed: false },
      { chargeItemId: 'FI0106', code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 800, amount: 800, removed: false },
      { chargeItemId: 'FI0107', code: '310301', name: '一次性使用关节镜刨削刀头', spec: '4.0mm', unit: '个', qty: 1, price: 260, amount: 260, removed: false },
      { chargeItemId: 'FI0108', code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 1, price: 100, amount: 100, removed: false },
      {
        chargeItemId: 'FI0109', code: '310302', name: '射频等离子消融电极', spec: '标准型', unit: '支',
        qty: 1, price: 120, amount: 120, removed: true,
        removeReason: '重复录入', removedBy: '张海涛', removedAt: dt(-1, 16, 10)
      },
      { chargeItemId: 'FI0110', code: '310401', name: '注射用头孢呋辛钠', spec: '1.5g', unit: '支', qty: 1, price: 56, amount: 56, removed: false }
    ],
    total: 4416, submittedAt: '', submittedBy: '',
    voidReason: '', voidedAt: '',
    createdAt: dt(-1, 15, 25), createdBy: '张海涛'
  },
  {
    // 沈云开：已提交的费用单（只读，用于「历史费用单」列表）
    chargeId: 'CJ20261104003', patientId: 'P107', status: 'SUBMITTED', groupName: '',
    lines: [
      { chargeItemId: 'FI0111', code: '310302', name: '射频等离子消融电极', spec: '标准型', unit: '支', qty: 1, price: 120, amount: 120, removed: false },
      { chargeItemId: 'FI0112', code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 1, price: 100, amount: 100, removed: false },
      { chargeItemId: 'FI0113', code: '310403', name: '丙泊酚注射液', spec: '20ml:0.2g', unit: '支', qty: 1, price: 96, amount: 96, removed: false }
    ],
    total: 316, submittedAt: dt(0, 8, 10), submittedBy: '张海涛',
    voidReason: '', voidedAt: '',
    createdAt: dt(0, 8, 0), createdBy: '张海涛'
  },
  {
    // 徐蔚然：已作废且尚未重新录入 → 费用列表按「已作废」筛选时可查到这一行
    chargeId: 'CJ20261104004', patientId: 'P102', status: 'VOIDED', groupName: '肩袖修补常用组套',
    lines: [
      { chargeItemId: 'FI0114', code: '310102', name: '肩关节镜下肩袖修补术', spec: '次', unit: '次', qty: 1, price: 5600, amount: 5600, removed: false },
      { chargeItemId: 'FI0115', code: '310305', name: '一次性使用带线锚钉', spec: '5.5mm', unit: '枚', qty: 2, price: 2100, amount: 4200, removed: false }
    ],
    total: 9800, submittedAt: dt(0, 7, 40), submittedBy: '周立',
    voidReason: '重复录入', voidedAt: dt(0, 8, 5),
    createdAt: dt(0, 7, 30), createdBy: '周立'
  }
]

/* ---------------- 补充演示医嘱 ----------------
 * 覆盖：待提交 / 口头医嘱 / 未执行 / 执行中 / 已执行 / 已停止 / 已作废 / 已移除
 */
function ord(id, patientId, o) {
  return {
    orderId: id, patientId, type: o.type || '临时',
    drugCode: o.drugCode, drugName: o.drugName, spec: o.spec,
    dose: o.dose, unit: o.unit, usage: o.usage, freq: o.freq || '一次',
    startTime: o.startTime, remark: o.remark || '', doctor: o.doctor || '张海涛',
    isAnesthetic: !!o.isAnesthetic, isVerbal: !!o.isVerbal,
    reciter: o.reciter || '', reciteTime: o.reciteTime || '', verbalNote: o.verbalNote || '',
    execStatus: o.execStatus, submittedAt: o.submittedAt || '', submittedBy: o.submittedBy || '',
    stopTime: o.stopTime || '', voidReason: o.voidReason || '',
    removed: !!o.removed, removeReason: o.removeReason || '', removedBy: o.removedBy || '', removedAt: o.removedAt || ''
  }
}

export const extraOrders = [
  // 蒲一鸣：待提交（书面）
  ord('ORD0101', 'P111', {
    drugCode: 'D0001', drugName: '丙泊酚注射液', spec: '20ml:0.2g', dose: 120, unit: 'mg',
    usage: '静注', freq: '一次', startTime: dt(0, 8, 30), isAnesthetic: true, execStatus: '待提交'
  }),
  // 蒲一鸣：待提交（口头医嘱，须填复述人与复述时间）
  ord('ORD0102', 'P111', {
    type: '长期', drugCode: 'D0012', drugName: '盐酸曲马多注射液', spec: '2ml:0.1g', dose: 100, unit: 'mg',
    usage: '肌注', freq: 'q12h', startTime: dt(0, 8, 35), isAnesthetic: false,
    isVerbal: true, reciter: '陈静', reciteTime: dt(0, 8, 40), verbalNote: '家属现场电话告知，主刀口嘱',
    execStatus: '待提交'
  }),
  // 蒲一鸣：已提交（未执行）
  ord('ORD0103', 'P111', {
    drugCode: 'D0010', drugName: '注射用泮托拉唑钠', spec: '40mg', dose: 40, unit: 'mg',
    usage: '静注', freq: '一次', startTime: dt(-1, 9, 0), isAnesthetic: false,
    execStatus: '未执行', submittedAt: dt(-1, 9, 5), submittedBy: '张海涛'
  }),
  // 蒲一鸣：执行中（长期医嘱，可停嘱）
  ord('ORD0104', 'P111', {
    type: '长期', drugCode: 'D0007', drugName: '注射用头孢呋辛钠', spec: '1.5g', dose: 1.5, unit: 'g',
    usage: '静滴', freq: 'q12h', startTime: dt(-1, 9, 10), isAnesthetic: false,
    execStatus: '执行中', submittedAt: dt(-1, 9, 15), submittedBy: '张海涛'
  }),
  // 蒲一鸣：已执行（只能作废）
  ord('ORD0105', 'P111', {
    drugCode: 'D0005', drugName: '盐酸利多卡因注射液', spec: '5ml:0.1g', dose: 100, unit: 'mg',
    usage: '局部浸润', freq: '一次', startTime: dt(-1, 9, 20), isAnesthetic: true,
    execStatus: '已执行', submittedAt: dt(-1, 9, 25), submittedBy: '张海涛'
  }),
  // 蒲一鸣：已停止（长期医嘱停嘱）
  ord('ORD0106', 'P111', {
    type: '长期', drugCode: 'D0008', drugName: '0.9% 氯化钠注射液', spec: '500ml', dose: 500, unit: 'ml',
    usage: '静滴', freq: 'q8h', startTime: dt(-1, 9, 30), isAnesthetic: false,
    execStatus: '已停止', submittedAt: dt(-1, 9, 35), submittedBy: '张海涛', stopTime: dt(-1, 14, 20)
  }),
  // 蒲一鸣：已作废
  ord('ORD0107', 'P111', {
    drugCode: 'D0011', drugName: '地塞米松磷酸钠注射液', spec: '1ml:5mg', dose: 5, unit: 'mg',
    usage: '静注', freq: '一次', startTime: dt(-1, 9, 40), isAnesthetic: false,
    execStatus: '已作废', submittedAt: dt(-1, 9, 45), submittedBy: '张海涛', voidReason: '组套选错'
  }),
  // 蒲一鸣：已移除（灰显保留，可恢复）
  ord('ORD0108', 'P111', {
    drugCode: 'D0009', drugName: '乳酸林格氏液', spec: '500ml', dose: 500, unit: 'ml',
    usage: '静滴', freq: '一次', startTime: dt(-1, 9, 50), isAnesthetic: false,
    execStatus: '执行中', submittedAt: dt(-1, 9, 55), submittedBy: '张海涛',
    removed: true, removeReason: '重复录入', removedBy: '张海涛', removedAt: dt(-1, 10, 0)
  }),
  // 王建军（术中）：执行中的麻醉药与术后用药
  ord('ORD0109', 'P005', {
    drugCode: 'D0005', drugName: '盐酸利多卡因注射液', spec: '5ml:0.1g', dose: 100, unit: 'mg',
    usage: '局部浸润', freq: '一次', startTime: dt(0, 7, 55), isAnesthetic: true,
    execStatus: '执行中', submittedAt: dt(0, 8, 0), submittedBy: '周立'
  }),
  ord('ORD0110', 'P005', {
    drugCode: 'D0001', drugName: '丙泊酚注射液', spec: '20ml:0.2g', dose: 120, unit: 'mg',
    usage: '静注', freq: '术中维持', startTime: dt(0, 7, 58), isAnesthetic: true,
    execStatus: '执行中', submittedAt: dt(0, 8, 0), submittedBy: '周立'
  }),
  ord('ORD0111', 'P005', {
    drugCode: 'D0015', drugName: '注射用帕瑞昔布钠', spec: '40mg', dose: 40, unit: 'mg',
    usage: '静注', freq: '一次', startTime: dt(0, 8, 10), isAnesthetic: false,
    execStatus: '已执行', submittedAt: dt(0, 8, 5), submittedBy: '周立'
  })
]

/* ---------------- 补充字典：停用的收费项目与停用的费用组套 ---------------- */
export const extraChargeItems = [
  { code: '310106', name: '经皮椎间孔镜下髓核摘除术', spec: '次', unit: '次', price: 4800, category: '手术费', enabled: true },
  { code: '310110', name: '拇外翻截骨矫形术', spec: '次', unit: '次', price: 3200, category: '手术费', enabled: true },
  // 停用项：字典里可见、不可被引用，停用原因与备注一并给出
  { code: '310408', name: '关节镜缝合针', spec: '2.0mm', unit: '枚', price: 180, category: '材料费', enabled: false },
  { code: '310409', name: '一次性使用无菌手套（10 只装）', spec: '10 只/袋', unit: '袋', price: 25, category: '材料费', enabled: false },
  { code: '310410', name: '钛合金接骨板（陈旧规格）', spec: '8 孔', unit: '块', price: 2200, category: '材料费', enabled: false },
  { code: '310411', name: '头孢哌酮舒巴坦钠注射液', spec: '1.5g', unit: '支', price: 85, category: '药品费', enabled: false }
]

export const extraGroups = [
  {
    groupId: 'G101', name: '椎间孔镜常用组套', enabled: true,
    lines: [
      { code: '310106', name: '经皮椎间孔镜下髓核摘除术', spec: '次', unit: '次', qty: 1, price: 4800 },
      { code: '310105', name: '麻醉操作技术费', spec: '次', unit: '次', qty: 1, price: 200 },
      { code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 800 },
      { code: '310304', name: '一次性使用麻醉穿刺包', spec: '常规', unit: '套', qty: 1, price: 100 },
      { code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 1, price: 100 },
      { code: '310402', name: '0.9% 氯化钠注射液', spec: '500ml', unit: '瓶', qty: 1, price: 24 },
      { code: '310403', name: '丙泊酚注射液', spec: '20ml:0.2g', unit: '支', qty: 1, price: 96 },
      { code: '310404', name: '注射用瑞芬太尼', spec: '1mg', unit: '支', qty: 1, price: 88 }
    ],
    total: 6208
  },
  {
    // 停用组套：历史单据仍能看到名称，新单不再调入
    groupId: 'G102', name: '拇外翻矫形常用组套（旧版）', enabled: false,
    lines: [
      { code: '310110', name: '拇外翻截骨矫形术', spec: '次', unit: '次', qty: 1, price: 3200 },
      { code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 800 },
      { code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 1, price: 100 },
      { code: '310401', name: '注射用头孢呋辛钠', spec: '1.5g', unit: '支', qty: 1, price: 56 }
    ],
    total: 4156
  }
]

/* ---------------- 补充演示操作日志 ----------------
 * 与初始种子的日志连成一条时间线：序号从初始日志之后接着排（由 startSeq 传入），
 * 只追加、不修改，与「操作日志只追加」的口径一致。
 * 覆盖动作类型：新增 / 修改 / 移除 / 作废 / 撤销 / 冲正 / 状态变更 / 导出 / 停用 / 启用 / 登录 / 退出登录 / 权限拦截
 */
export function buildExtraLogs(startSeq = 45) {
  const out = []
  let seq = startSeq

  const L = (time, operator, role, module, page, action, targetType, targetId, targetName,
    patientId, before, after, reason, extra = {}) => {
    const s = seq++
    out.push(Object.freeze({
      seq: s,
      logId: 'LOG' + String(s).padStart(8, '0'),
      time, operator, role, module, page, action,
      targetType, targetId, targetName,
      patientId: patientId || null,
      before: before || null,
      after: after || null,
      diff: before && after ? diffFields(before, after) : [],
      reason: reason || '',
      result: extra.result || 'SUCCESS',
      failReason: extra.failReason || '',
      client: 'Web / Chrome / 192.168.10.24',
      chain: makeChain(s, time, targetId, after)
    }))
  }

  const no = 'D2026101', name101 = '曹秀珍'

  /* ---- P101 曹秀珍：部分冻结 + 预约与安排不一致 ---- */
  L(dt(-4, 9, 30, 12), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109104', name101 + ' ' + no, 'P101',
    null, { 申请单号: 'APL20261109104', 业务模式: '手术麻醉' }, '接收 HIS 日间手术申请单')
  L(dt(-4, 10, 2, 40), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', no, name101 + ' ' + no, 'P101',
    null, { 住院号: no, 患者状态: '术前准备', 申请单号: 'APL20261109104' }, '从申请单 APL20261109104 建档')
  L(dt(-4, 9, 30, 12), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1101', name101 + ' ' + no, 'P101',
    null, { 发生金额: '6,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-3, 14, 20, 5), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1102', name101 + ' ' + no, 'P101',
    null, { 发生金额: '2,000.00', 业务类型: '缴存', 可用余额: '8,000.00' }, '门诊缴存日间手术专项储值金（银行卡）')
  L(dt(-3, 9, 20, 14), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL101', name101 + ' 专科评估', 'P101',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '术前检查报告齐全，准予进入日间手术流程')
  L(dt(-3, 10, 5, 9), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL102', name101 + ' 麻醉评估', 'P101',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA II' }, '轻度贫血，术中备输血，术后镇痛泵')
  L(dt(-2, 9, 15, 40), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A101', name101 + ' ' + no, 'P101',
    { 可用余额: '8,000.00', 冻结金额: '0.00' }, { 可用余额: '3,000.00', 冻结金额: '5,000.00', 冻结用途: '术前检查费用记账', 关联申请单号: 'APL20261109104' },
    '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-2, 15, 10, 3), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000106', name101 + ' ' + no, 'P101',
    null, { 手术日期: d(2), 手术间: '日间 1 间', 台次: '第 1 台', 主刀医师: '张海涛' }, '创建手术预约（预约成功短信与入院前提醒已生成）')
  L(dt(-1, 16, 40, 12), '陈静', '护士', 'SCH', '手术排程', 'UPDATE', '手术排程', 'SCH00000106', name101 + ' ' + no, 'P101',
    { 手术日期: d(2), 手术间: '日间 1 间', 台次: '第 1 台' }, { 手术日期: d(2), 手术间: '日间 2 间', 台次: '第 1 台', 预约信息: '与实际安排不一致' },
    '手术室临时调整，已发送变更通知')
  L(dt(-1, 16, 40, 35), '陈静', '护士', 'MSG', '消息通知', 'CREATE', '通知', 'MSG103', name101 + ' 安排变动', 'P101',
    null, { 类型: '安排变动', 渠道: '短信 + 电话' }, '调整实际安排与预约不一致，按参数同时短信与电话通知')

  /* ---- P102 徐蔚然：ASA Ⅲ + 当日入院（可撤销入院登记） ---- */
  L(dt(-5, 9, 10, 12), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109105', '徐蔚然 D2026102', 'P102',
    null, { 申请单号: 'APL20261109105', 业务模式: '手术麻醉' }, '接收 HIS 日间手术申请单')
  L(dt(-5, 9, 40, 30), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026102', '徐蔚然 D2026102', 'P102',
    null, { 住院号: 'D2026102', 患者状态: '术前准备' }, '从申请单 APL20261109105 建档')
  L(dt(-5, 9, 10, 11), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1104', '徐蔚然 D2026102', 'P102',
    null, { 发生金额: '9,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 9, 30, 22), '周立', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL103', '徐蔚然 专科评估', 'P102',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '肩峰下撞击明确，限期手术')
  L(dt(-4, 10, 15, 8), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL104', '徐蔚然 麻醉评估', 'P102',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA III', 建议麻醉方式: '全身麻醉' },
    'ASA Ⅲ 级：合并 2 型糖尿病与高血压，胰岛素泵调控血糖，术中严密监测血压波动')
  L(dt(-4, 9, 5, 20), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A102', '徐蔚然 D2026102', 'P102',
    { 可用余额: '9,000.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '9,000.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-4, 9, 15, 40), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000103', '徐蔚然 D2026102', 'P102',
    null, { 手术日期: d(1), 手术间: '日间 1 间', 台次: '第 2 台', 主刀医师: '周立' }, '创建手术预约（预约成功短信与入院前提醒已生成）')
  L(dt(0, 8, 15), '陈静', '护士', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A102', '徐蔚然 D2026102', 'P102',
    { 冻结金额: '9,000.00', 住院储值金: '0.00' }, { 冻结金额: '0.00', 住院储值金: '9,000.00', 账户状态: '已转入住院' },
    '入院登记，冻结金额转入住院储值金')
  L(dt(0, 8, 15), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026102', '徐蔚然 D2026102', 'P102',
    { 患者状态: '已排程' }, { 患者状态: '已入院', 床号: '日间 08 床', 住院储值金转入: '9,000.00' },
    '从 HIS 读取住院证并办理入院登记')

  /* ---- P103 严文博：转住院（转科） ---- */
  L(dt(-6, 10, 5, 12), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109106', '严文博 D2026103', 'P103',
    null, { 申请单号: 'APL20261109106' }, '接收 HIS 日间手术申请单')
  L(dt(-6, 10, 40, 20), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026103', '严文博 D2026103', 'P103',
    null, { 住院号: 'D2026103', 患者状态: '术前准备' }, '从申请单 APL20261109106 建档')
  L(dt(-6, 10, 5, 1), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1107', '严文博 D2026103', 'P103',
    null, { 发生金额: '7,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-5, 9, 10, 18), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL105', '严文博 专科评估', 'P103',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '骨性愈合良好，限期取出内固定')
  L(dt(-5, 9, 50, 3), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL106', '严文博 麻醉评估', 'P103',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA II', 建议麻醉方式: '椎管内麻醉' }, '腰穿困难，备全麻转管')
  L(dt(-5, 9, 30, 12), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A103', '严文博 D2026103', 'P103',
    { 可用余额: '7,000.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '7,000.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-2, 10, 30, 8), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000107', '严文博 D2026103', 'P103',
    null, { 手术日期: d(-2), 手术间: '日间 3 间', 台次: '第 2 台', 麻醉方式: '静脉麻醉' }, '创建手术预约')
  L(dt(-2, 8, 0, 5), '陈静', '护士', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A103', '严文博 D2026103', 'P103',
    { 冻结金额: '7,000.00', 住院储值金: '0.00' }, { 冻结金额: '0.00', 住院储值金: '7,000.00', 账户状态: '已转入住院' },
    '入院登记，冻结金额转入住院储值金')
  L(dt(-2, 7, 50), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026103', '严文博 D2026103', 'P103',
    { 患者状态: '已排程' }, { 患者状态: '已入院', 床号: '日间 09 床' }, '从 HIS 读取住院证并办理入院登记')
  L(dt(-2, 7, 50), '陈静', '护士', 'CIR', '手术报到', 'STATUS', '报到记录', 'CIR000102', '严文博 D2026103', 'P103',
    { 患者状态: '已入院' }, { 患者状态: '术中', 报到方式: '刷身份证', 四项校验: '全部通过' }, '报到登记')
  L(dt(-2, 15, 40), '张海涛', '医生', 'TRF', '转普通住院', 'STATUS', '患者', 'D2026103', '严文博 D2026103', 'P103',
    { 患者状态: '已入院/术中', 患者类型: '日间手术患者' }, { 患者状态: '普通住院', 转住院原因: '术后出现并发症', 转住院方式: '转科' },
    '术后出现并发症；方式：转科；备注：术后切口渗血伴低热，转创伤骨科继续抗感染治疗')

  /* ---- P104 汤春燕：转住院后撤销 ---- */
  L(dt(-5, 14, 20, 40), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109107', '汤春燕 D2026104', 'P104',
    null, { 申请单号: 'APL20261109107' }, '接收 HIS 日间手术申请单')
  L(dt(-5, 15, 0, 12), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026104', '汤春燕 D2026104', 'P104',
    null, { 住院号: 'D2026104', 患者状态: '术前准备' }, '从申请单 APL20261109107 建档')
  L(dt(-5, 14, 20, 33), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1110', '汤春燕 D2026104', 'P104',
    null, { 发生金额: '6,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 9, 40, 11), '李伟', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL107', '汤春燕 专科评估', 'P104',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '间歇性跛行走，限期手术')
  L(dt(-4, 10, 20, 5), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL108', '汤春燕 麻醉评估', 'P104',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA II', 建议麻醉方式: '全身麻醉' }, '长期口服糖皮质激素，术中预防性补液')
  L(dt(-4, 10, 0, 12), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A104', '汤春燕 D2026104', 'P104',
    { 可用余额: '6,000.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '6,000.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-1, 8, 5, 40), '陈静', '护士', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A104', '汤春燕 D2026104', 'P104',
    { 冻结金额: '6,000.00', 住院储值金: '0.00' }, { 冻结金额: '0.00', 住院储值金: '6,000.00', 账户状态: '已转入住院' },
    '入院登记，冻结金额转入住院储值金')
  L(dt(-1, 9, 30), '李伟', '医生', 'TRF', '转普通住院', 'STATUS', '患者', 'D2026104', '汤春燕 D2026104', 'P104',
    { 患者状态: '已入院/术中', 患者类型: '日间手术患者' }, { 患者状态: '普通住院', 转住院原因: '患者及家属要求', 转住院方式: '重新开具住院证' },
    '患者及家属要求；方式：重新开具住院证')
  L(dt(-1, 14, 10), '李伟', '医生', 'TRF', '转普通住院', 'CANCEL', '转住院记录', 'D2026104', '汤春燕 D2026104', 'P104',
    { 患者状态: '普通住院', 转住院原因: '患者及家属要求' }, { 患者状态: '已入院' }, '录入错误，患者暂不转普通住院')
  L(dt(-1, 15, 20), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000104', '汤春燕 D2026104', 'P104',
    null, { 手术日期: d(1), 手术间: '日间 1 间', 台次: '第 1 台', 主刀医师: '李伟' }, '创建手术预约')
  L(dt(-1, 15, 20), '陈静', '护士', 'SCH', '手术排程', 'UPDATE', '手术排程', 'SCH00000104', '汤春燕 D2026104', 'P104',
    { 手术日期: d(1), 手术间: '日间 1 间', 台次: '第 1 台' }, { 手术日期: d(1), 手术间: '日间 2 间', 台次: '第 1 台', 预约信息: '与实际安排不一致' },
    '手术室临时调整，已发送变更通知')

  /* ---- P105 钟启明：手工发起退出 ---- */
  L(dt(-4, 10, 30, 15), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109108', '钟启明 D2026105', 'P105',
    null, { 申请单号: 'APL20261109108' }, '接收 HIS 日间手术申请单')
  L(dt(-4, 10, 55, 3), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026105', '钟启明 D2026105', 'P105',
    null, { 住院号: 'D2026105', 患者状态: '术前准备' }, '从申请单 APL20261109108 建档')
  L(dt(-4, 10, 30, 12), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1113', '钟启明 D2026105', 'P105',
    null, { 发生金额: '5,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-3, 9, 10, 8), '周立', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL109', '钟启明 专科评估', 'P105',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '神经传导检查提示中度压迫，限期手术')
  L(dt(-3, 9, 20, 5), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A105', '钟启明 D2026105', 'P105',
    { 可用余额: '5,000.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '5,000.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-2, 11, 10), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000109', '钟启明 D2026105', 'P105',
    null, { 手术日期: d(-2), 手术间: '日间 2 间', 台次: '第 1 台' }, '创建手术预约')
  L(dt(-2, 11, 15), '陈静', '护士', 'SCH', '手术排程', 'CANCEL', '手术预约', 'SCH00000109', '钟启明 D2026105', 'P105',
    { 排程状态: '已预约' }, { 排程状态: '已取消', 取消原因: '患者放弃手术' }, '患者放弃手术')
  L(dt(-2, 11, 20), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '患者', 'D2026105', '钟启明 D2026105', 'P105',
    { 患者状态: '术前准备' }, { 患者状态: '已退出', 退出原因: '患者放弃' },
    '发起退出日间手术：患者放弃（患者临时家属反对手术，手工发起退出；冻结金额仍待收费员解冻结算）')
  L(dt(-2, 11, 15), '陈静', '护士', 'MSG', '消息通知', 'CREATE', '通知', 'MSG104', '钟启明 取消通知', 'P105',
    null, { 类型: '取消通知', 渠道: '短信' }, '取消手术预约后自动发送取消通知')

  /* ---- P106 侯小妮：麻醉评估不通过 + 多分单分别结算 ---- */
  L(dt(-7, 10, 0, 8), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109109', '侯小妮 D2026106', 'P106',
    null, { 申请单号: 'APL20261109109' }, '接收 HIS 日间手术申请单')
  L(dt(-7, 10, 40, 20), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026106', '侯小妮 D2026106', 'P106',
    null, { 住院号: 'D2026106', 患者状态: '术前准备' }, '从申请单 APL20261109109 建档')
  L(dt(-18, 10, 0, 5), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1115', '侯小妮 D2026106', 'P106',
    null, { 发生金额: '10,000.00', 业务类型: '缴存' }, '两次日间手术共缴存，账户按分单分别管理')
  L(dt(-4, 9, 50, 11), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL110', '侯小妮 专科评估', 'P106',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '术前检查未见异常')
  L(dt(-3, 15, 50), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL111', '侯小妮 麻醉评估', 'P106',
    { 麻醉评估: '待评估' }, { 结论: '不通过', 评估类型: '麻醉评估', 未通过原因: '麻醉风险评估过高' },
    'ASA IV 级，合并慢性阻塞性肺疾病与心功能不全，不宜日间手术')
  L(dt(-3, 16, 5), '系统自动', '系统', 'DEP', '储值金管理', 'STATUS', '患者', 'D2026106', '侯小妮 D2026106', 'P106',
    { 患者状态: '术前准备' }, { 患者状态: '已退出', 退出原因: '麻醉评估不通过' },
    '麻醉评估不通过，自动退出日间手术（麻醉风险评估过高：ASA IV 级，合并慢性阻塞性肺疾病与心功能不全，不宜日间手术）')
  L(dt(-3, 16, 12), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '门诊结算单', 'JSM20261106002', '侯小妮 D2026106', 'P106',
    { 可用余额: '0.00', 冻结金额: '5,000.00' }, { 账户状态: '已结算', 分单数: '2', 费用合计: '1,520.00', 退回金额: '8,480.00', 结算单号: 'JSM20261104001、JSM20261106002' },
    '解冻储值金并门诊结算：麻醉评估不通过（两张分单分别结算，各出一张门诊结算单）')

  /* ---- P107 沈云开：报到后取消报到 ---- */
  L(dt(-5, 10, 15, 10), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109110', '沈云开 D2026107', 'P107',
    null, { 申请单号: 'APL20261109110' }, '接收 HIS 日间手术申请单')
  L(dt(-5, 10, 50, 25), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026107', '沈云开 D2026107', 'P107',
    null, { 住院号: 'D2026107', 患者状态: '术前准备' }, '从申请单 APL20261109110 建档')
  L(dt(-5, 10, 15, 4), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1120', '沈云开 D2026107', 'P107',
    null, { 发生金额: '6,500.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 9, 30, 8), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL112', '沈云开 专科评估', 'P107',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '关节游离体明确，限期手术')
  L(dt(-4, 10, 0, 6), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL113', '沈云开 麻醉评估', 'P107',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA I', 建议麻醉方式: '局部浸润麻醉' }, '局部浸润麻醉，无需禁食')
  L(dt(-4, 9, 40, 8), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A107', '沈云开 D2026107', 'P107',
    { 可用余额: '6,500.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '6,500.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-1, 8, 25, 3), '陈静', '护士', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A107', '沈云开 D2026107', 'P107',
    { 冻结金额: '6,500.00', 住院储值金: '0.00' }, { 冻结金额: '0.00', 住院储值金: '6,500.00', 账户状态: '已转入住院' },
    '入院登记，冻结金额转入住院储值金')
  L(dt(-1, 8, 25), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026107', '沈云开 D2026107', 'P107',
    { 患者状态: '已排程' }, { 患者状态: '已入院', 床号: '日间 11 床' }, '从 HIS 读取住院证并办理入院登记')
  L(dt(0, 7, 40), '陈静', '护士', 'CIR', '手术报到', 'STATUS', '报到记录', 'CIR000101', '沈云开 D2026107', 'P107',
    { 患者状态: '已入院' }, { 患者状态: '术中', 报到方式: '刷医保卡', 四项校验: '全部通过' }, '报到登记')
  L(dt(0, 8, 5), '陈静', '护士', 'CIR', '手术报到', 'CANCEL', '报到记录', 'CIR000101', '沈云开 D2026107', 'P107',
    { 患者状态: '术中', 报到记录: 'CIR000101' }, { 患者状态: '已入院', 报到记录: '已作废' }, '患者临时改期，撤回本次报到')

  /* ---- P108 万家骏：评估不通过（其他） ---- */
  L(dt(-4, 11, 0, 25), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109111', '万家骏 D2026108', 'P108',
    null, { 申请单号: 'APL20261109111' }, '接收 HIS 日间手术申请单')
  L(dt(-4, 11, 30, 40), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026108', '万家骏 D2026108', 'P108',
    null, { 住院号: 'D2026108', 患者状态: '术前准备' }, '从申请单 APL20261109111 建档')
  L(dt(-4, 11, 0, 18), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1123', '万家骏 D2026108', 'P108',
    null, { 发生金额: '4,800.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-3, 9, 30, 44), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A108', '万家骏 D2026108', 'P108',
    { 可用余额: '4,800.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '4,800.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-1, 9, 40), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL114', '万家骏 专科评估', 'P108',
    { 专科评估: '待评估' }, { 结论: '不通过', 评估类型: '专科评估', 未通过原因: '其他' },
    '术前访视发现牙周活动性感染灶，需抗感染治疗后再评估')
  L(dt(-1, 9, 50), '系统自动', '系统', 'DEP', '储值金管理', 'STATUS', '患者', 'D2026108', '万家骏 D2026108', 'P108',
    { 患者状态: '术前准备' }, { 患者状态: '已退出', 退出原因: '评估不通过' },
    '评估不通过自动退出：其他：术前访视发现牙周活动性感染灶，需抗感染治疗后再评估')

  /* ---- P109 顾爱民：储值金冲正 + 预约取消 ---- */
  L(dt(-5, 9, 30, 18), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109112', '顾爱民 D2026109', 'P109',
    null, { 申请单号: 'APL20261109112' }, '接收 HIS 日间手术申请单')
  L(dt(-5, 10, 0, 30), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026109', '顾爱民 D2026109', 'P109',
    null, { 住院号: 'D2026109', 患者状态: '术前准备' }, '从申请单 APL20261109112 建档')
  L(dt(-5, 9, 30, 12), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1125', '顾爱民 D2026109', 'P109',
    null, { 发生金额: '6,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 10, 15, 33), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1126', '顾爱民 D2026109', 'P109',
    null, { 发生金额: '2,000.00', 业务类型: '缴存', 可用余额: '8,000.00' }, '门诊缴存日间手术专项储值金（扫码）')
  L(dt(-3, 9, 5, 18), '王芳', '收费员', 'DEP', '储值金管理', 'REVERSE', '储值金流水', 'F1127', '顾爱民 D2026109', 'P109',
    { 缴存总额: '8,000.00', 可用余额: '8,000.00' }, { 缴存总额: '6,000.00', 可用余额: '6,000.00', 原流水: 'F1126', 冲正金额: '2,000.00' },
    '冲正 F1126：金额录入错误')
  L(dt(-4, 9, 10, 4), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL115', '顾爱民 专科评估', 'P109',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '骨性愈合良好，限期取出内固定')
  L(dt(-4, 9, 40, 6), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL116', '顾爱民 麻醉评估', 'P109',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA II', 建议麻醉方式: '全身麻醉' }, '高血压病史，术中控制性降压')
  L(dt(-1, 11, 0), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000110', '顾爱民 D2026109', 'P109',
    null, { 手术日期: d(-1), 手术间: '日间 2 间', 台次: '第 2 台' }, '创建手术预约')
  L(dt(-1, 11, 10), '陈静', '护士', 'SCH', '手术排程', 'CANCEL', '手术预约', 'SCH00000110', '顾爱民 D2026109', 'P109',
    { 排程状态: '已预约' }, { 排程状态: '已取消', 取消原因: '手术室资源调整' }, '手术室资源调整')

  /* ---- P110 龙玉兰：手术完成当日离院 ---- */
  L(dt(-8, 9, 30, 20), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109113', '龙玉兰 D2026110', 'P110',
    null, { 申请单号: 'APL20261109113' }, '接收 HIS 日间手术申请单')
  L(dt(-8, 10, 0, 40), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026110', '龙玉兰 D2026110', 'P110',
    null, { 住院号: 'D2026110', 患者状态: '术前准备' }, '从申请单 APL20261109113 建档')
  L(dt(-8, 9, 30, 10), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1128', '龙玉兰 D2026110', 'P110',
    null, { 发生金额: '5,500.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-7, 9, 20, 6), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL117', '龙玉兰 专科评估', 'P110',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '术前检查未见异常')
  L(dt(-7, 10, 0, 3), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL118', '龙玉兰 麻醉评估', 'P110',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA II', 建议麻醉方式: '全身麻醉' }, '老年患者，术中保温，术后早期下床')
  L(dt(-7, 9, 40, 22), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A110', '龙玉兰 D2026110', 'P110',
    { 可用余额: '5,500.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '5,500.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-6, 9, 0, 12), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术预约', 'SCH00000111', '龙玉兰 D2026110', 'P110',
    null, { 手术日期: d(-6), 手术间: '日间 1 间', 台次: '第 1 台' }, '创建手术预约')
  L(dt(-6, 7, 45, 1), '陈静', '护士', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A110', '龙玉兰 D2026110', 'P110',
    { 冻结金额: '5,500.00', 住院储值金: '0.00' }, { 冻结金额: '0.00', 住院储值金: '5,500.00', 账户状态: '已转入住院' },
    '入院登记，冻结金额转入住院储值金')
  L(dt(-6, 7, 45), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026110', '龙玉兰 D2026110', 'P110',
    { 患者状态: '已排程' }, { 患者状态: '已入院', 床号: '日间 02 床' }, '从 HIS 读取住院证并办理入院登记')
  L(dt(-6, 7, 55), '陈静', '护士', 'CIR', '手术报到', 'STATUS', '报到记录', 'CIR000103', '龙玉兰 D2026110', 'P110',
    { 患者状态: '已入院' }, { 患者状态: '术中', 报到方式: '手工输入住院号', 四项校验: '全部通过' }, '报到登记')
  L(dt(-6, 12, 10), '张海涛', '医生', 'CHG', '手术费用', 'STATUS', '费用单', 'CJ20261104004', '龙玉兰 D2026110', 'P110',
    { 单据状态: '编辑中', 合计: '0.00' }, { 单据状态: '已提交', 合计: '4,180.00', 明细条数: '6' }, '提交手术费用')
  L(dt(-6, 16, 40), '张海涛', '医生', 'BAS', '工作台', 'STATUS', '患者', 'D2026110', '龙玉兰 D2026110', 'P110',
    { 患者状态: '术中' }, { 患者状态: '已出院' }, '日间手术完成，当日离院')

  /* ---- P111 蒲一鸣：费用作废重录 + 医嘱全状态 ---- */
  L(dt(-5, 9, 15, 12), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109114', '蒲一鸣 D2026111', 'P111',
    null, { 申请单号: 'APL20261109114' }, '接收 HIS 日间手术申请单')
  L(dt(-5, 9, 45, 30), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026111', '蒲一鸣 D2026111', 'P111',
    null, { 住院号: 'D2026111', 患者状态: '术前准备' }, '从申请单 APL20261109114 建档')
  L(dt(-5, 9, 15, 7), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1131', '蒲一鸣 D2026111', 'P111',
    null, { 发生金额: '7,500.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 9, 30, 9), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL119', '蒲一鸣 专科评估', 'P111',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '术前检查未见异常，关节活动度可')
  L(dt(-4, 10, 10, 2), '罗建平', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL120', '蒲一鸣 麻醉评估', 'P111',
    { 麻醉评估: '待评估' }, { 结论: '通过', ASA: 'ASA I', 建议麻醉方式: '局部浸润麻醉' }, '局麻+镇静，术中唤醒确认下肢肌力')
  L(dt(-4, 9, 50, 33), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A111', '蒲一鸣 D2026111', 'P111',
    { 可用余额: '7,500.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '7,500.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-1, 8, 50, 12), '陈静', '护士', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A111', '蒲一鸣 D2026111', 'P111',
    { 冻结金额: '7,500.00', 住院储值金: '0.00' }, { 冻结金额: '0.00', 住院储值金: '7,500.00', 账户状态: '已转入住院' },
    '入院登记，冻结金额转入住院储值金')
  L(dt(-1, 8, 50), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026111', '蒲一鸣 D2026111', 'P111',
    { 患者状态: '已排程' }, { 患者状态: '已入院', 床号: '日间 12 床' }, '从 HIS 读取住院证并办理入院登记')
  L(dt(-1, 11, 30), '张海涛', '医生', 'CHG', '手术费用', 'CREATE', '费用单', 'CJ20261104001', '蒲一鸣 D2026111', 'P111',
    null, { 组套: '膝关节镜常用组套', 明细条数: '4', 合计: '4,360.00' }, '调入常用组套「膝关节镜常用组套」4 条明细')
  L(dt(-1, 11, 40), '张海涛', '医生', 'CHG', '手术费用', 'STATUS', '费用单', 'CJ20261104001', '蒲一鸣 D2026111', 'P111',
    { 单据状态: '编辑中', 合计: '4,360.00' }, { 单据状态: '已提交', 合计: '4,360.00', 明细条数: '4' }, '提交手术费用')
  L(dt(-1, 15, 20), '张海涛', '医生', 'CHG', '手术费用', 'VOID', '费用单', 'CJ20261104001', '蒲一鸣 D2026111', 'P111',
    { 单据状态: '已提交', 合计: '4,360.00' }, { 单据状态: '已作废', 作废原因: '组套选错' }, '组套选错')
  L(dt(-1, 15, 25), '张海涛', '医生', 'CHG', '手术费用', 'CREATE', '费用单', 'CJ20261104002', '蒲一鸣 D2026111', 'P111',
    null, { 来源单号: 'CJ20261104001', 明细条数: '6', 合计: '4,416.00' }, '基于已作废费用单 CJ20261104001 重新录入')
  L(dt(-1, 16, 10), '张海涛', '医生', 'CHG', '手术费用', 'REMOVE', '费用明细', 'FI0109', '射频等离子消融电极', 'P111',
    { 项目: '射频等离子消融电极', 数量: 1, 金额: '120.00', 状态: '正常' }, { 状态: '已移除（可恢复）', 移除后合计: '4,416.00' },
    '重复录入')
  L(dt(0, 8, 30), '张海涛', '医生', 'ORD', '手术医嘱', 'CREATE', '医嘱', 'ORD0101', '丙泊酚注射液 120mg', 'P111',
    null, { 药品: '丙泊酚注射液', 规格: '20ml:0.2g', 剂量: '120mg', 用法: '静注', 频次: '一次', 麻醉药: '是', 医嘱类型: '书面医嘱', 执行状态: '待提交' },
    '录入手术医嘱（待提交）')
  L(dt(0, 8, 35), '张海涛', '医生', 'ORD', '手术医嘱', 'CREATE', '医嘱', 'ORD0102', '盐酸曲马多注射液 100mg', 'P111',
    null, { 药品: '盐酸曲马多注射液', 规格: '2ml:0.1g', 剂量: '100mg', 用法: '肌注', 频次: 'q12h', 麻醉药: '否', 医嘱类型: '口头医嘱', 执行状态: '待提交', 复述人: '陈静' },
    '录入口头医嘱（待提交）')
  L(dt(0, 8, 45), '张海涛', '医生', 'ORD', '手术医嘱', 'STATUS', '医嘱', 'ORD0103、ORD0104', '蒲一鸣 D2026111 2 条医嘱', 'P111',
    { 待提交医嘱数: '2', 执行状态: '待提交' }, { 提交医嘱数: '2', 执行状态: '已提交' }, '记录确认无误，一次性提交手术医嘱')
  L(dt(0, 8, 50), '张海涛', '医生', 'ORD', '手术医嘱', 'REMOVE', '医嘱', 'ORD0108', '乳酸林格氏液 500ml', 'P111',
    { 药品: '乳酸林格氏液', 剂量: '500ml', 状态: '正常' }, { 状态: '已移除（可恢复）' }, '重复录入')
  L(dt(0, 8, 55), '张海涛', '医生', 'ORD', '手术医嘱', 'STATUS', '医嘱', 'ORD0106', '0.9% 氯化钠注射液 500ml', 'P111',
    { 执行状态: '执行中' }, { 执行状态: '已停止', 停止时间: dt(0, 8, 55) }, '术后已补液，停止该医嘱')
  L(dt(0, 9, 0), '张海涛', '医生', 'ORD', '手术医嘱', 'VOID', '医嘱', 'ORD0107', '地塞米松磷酸钠注射液 5mg', 'P111',
    { 执行状态: '执行中' }, { 执行状态: '已作废', 作废原因: '组套选错' }, '组套选错')

  /* ---- P112 白玉兰：评估不通过（血糖控制不佳） ---- */
  L(dt(-5, 10, 20, 22), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109115', '白玉兰 D2026112', 'P112',
    null, { 申请单号: 'APL20261109115' }, '接收 HIS 日间手术申请单')
  L(dt(-5, 10, 50, 35), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026112', '白玉兰 D2026112', 'P112',
    null, { 住院号: 'D2026112', 患者状态: '术前准备' }, '从申请单 APL20261109115 建档')
  L(dt(-5, 10, 20, 15), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1134', '白玉兰 D2026112', 'P112',
    null, { 发生金额: '6,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 9, 30, 44), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A112', '白玉兰 D2026112', 'P112',
    { 可用余额: '6,000.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '6,000.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-2, 10, 15), '李伟', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL121', '白玉兰 专科评估', 'P112',
    { 专科评估: '待评估' }, { 结论: '不通过', 评估类型: '专科评估', 未通过原因: '血糖控制不佳' },
    '空腹血糖 13.2mmol/L，糖化血红蛋白 9.8%，暂不宜手术')
  L(dt(-2, 10, 25), '系统自动', '系统', 'DEP', '储值金管理', 'STATUS', '患者', 'D2026112', '白玉兰 D2026112', 'P112',
    { 患者状态: '术前准备' }, { 患者状态: '已退出', 退出原因: '评估不通过' },
    '评估不通过自动退出：血糖控制不佳：空腹血糖 13.2mmol/L，糖化血红蛋白 9.8%，暂不宜手术')

  /* ---- P113 / P114 / P115：术前评估列表的三种在途状态 ---- */
  L(dt(-2, 9, 30, 20), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109116', '温书瑶 D2026113', 'P113',
    null, { 申请单号: 'APL20261109116' }, '接收 HIS 日间手术申请单')
  L(dt(-2, 10, 0, 25), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026113', '温书瑶 D2026113', 'P113',
    null, { 住院号: 'D2026113', 患者状态: '术前准备' }, '从申请单 APL20261109116 建档')
  L(dt(-2, 9, 30, 12), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1136', '温书瑶 D2026113', 'P113',
    null, { 发生金额: '5,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-4, 9, 0, 28), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109117', '戚文轩 D2026114', 'P114',
    null, { 申请单号: 'APL20261109117' }, '接收 HIS 日间手术申请单')
  L(dt(-4, 9, 30, 10), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026114', '戚文轩 D2026114', 'P114',
    null, { 住院号: 'D2026114', 患者状态: '术前准备' }, '从申请单 APL20261109117 建档')
  L(dt(-4, 9, 0, 20), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1137', '戚文轩 D2026114', 'P114',
    null, { 发生金额: '6,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')
  L(dt(-3, 9, 40, 5), '王芳', '收费员', 'DEP', '储值金管理', 'STATUS', '储值金账户', 'A114', '戚文轩 D2026114', 'P114',
    { 可用余额: '6,000.00', 冻结金额: '0.00' }, { 可用余额: '0.00', 冻结金额: '6,000.00' }, '储值金冻结（专款专用）：术前检查费用记账')
  L(dt(-1, 10, 30), '周立', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL122', '戚文轩 专科评估', 'P114',
    { 专科评估: '待评估' }, { 结论: '通过', 评估类型: '专科评估' }, '神经传导检查提示轻度压迫，限期手术')
  L(dt(-1, 15, 20, 50), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL20261109118', '蓝月华 D2026115', 'P115',
    null, { 申请单号: 'APL20261109118' }, '接收 HIS 日间手术申请单')
  L(dt(-1, 15, 50, 30), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'D2026115', '蓝月华 D2026115', 'P115',
    null, { 住院号: 'D2026115', 患者状态: '术前准备' }, '从申请单 APL20261109118 建档')
  L(dt(-1, 15, 20, 44), '王芳', '收费员', 'DEP', '储值金管理', 'CREATE', '储值金流水', 'F1139', '蓝月华 D2026115', 'P115',
    null, { 发生金额: '6,800.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金')

  /* ---- 动作类型补齐：登录 / 退出登录 / 停用 / 启用 / 导出 / 重发 / 撤销 ---- */
  L(dt(0, 8, 0, 12), '李伟', '系统管理员', 'SYS', '登录页', 'LOGIN', '登录', 'SESSION-2026', '李伟（系统管理员）', null,
    null, { 登录方式: '演示账号直接登录', 工号: 'A0001' }, '选择岗位登录（演示环境不校验密码）')
  L(dt(0, 8, 2, 30), '李伟', '系统管理员', 'SYS', '登录页', 'LOGOUT', '登录', 'SESSION-2026', '李伟（系统管理员）', null,
    { 登录状态: '已登录' }, { 登录状态: '已退出' }, '退出登录，切换岗位')
  L(dt(-1, 16, 40), '李伟', '系统管理员', 'DICT', '收费项目字典', 'DISABLE', '收费项目', '310410', '钛合金接骨板（陈旧规格）', null,
    { 状态: '启用' }, { 状态: '停用' }, '启用字典项')
  L(dt(-1, 16, 45), '李伟', '系统管理员', 'DICT', '收费项目字典', 'ENABLE', '收费项目', '310410', '钛合金接骨板（陈旧规格）', null,
    { 状态: '停用' }, { 状态: '启用' }, '停用字典项')
  L(dt(-2, 7, 58), '陈静', '护士', 'CIR', '手术报到', 'EXPORT', '知情同意书', 'CIR000103', '龙玉兰 D2026110', 'P110',
    null, { 文书: '手术知情同意书', 打印状态: '已发送至打印队列' }, '打印手术知情同意书')
  L(dt(-1, 9, 30), '王芳', '收费员', 'MSG', '消息通知', 'UPDATE', '通知', 'MSG101', '徐蔚然 预约成功', 'P102',
    { 通知状态: '发送失败', 失败原因: '网关返回：短信通道拥塞，请稍后重试' }, { 通知状态: '已发送', 重发次数: '1' }, '通知重发')
  L(dt(0, 8, 15), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026102', '徐蔚然 D2026102', 'P102',
    { 患者状态: '已排程' }, { 患者状态: '已入院', 床号: '日间 08 床' }, '从 HIS 读取住院证并办理入院登记（刷身份证）')
  L(dt(0, 8, 16), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026102', '徐蔚然 D2026102', 'P102',
    { 患者状态: '已入院', 床位: '日间 08 床' }, { 患者状态: '已排程', 床位: '（释放）' }, '撤销入院登记，床位释放')
  L(dt(0, 8, 16), '陈静', '护士', 'ADM', '入院登记', 'STATUS', '入院登记单', 'RJ2026102', '徐蔚然 D2026102', 'P102',
    { 患者状态: '已入院' }, { 患者状态: '已排程' }, '撤销入院登记后重新办理入院登记')

  /* ---- 失败留痕：接口层拦截与业务校验失败 ---- */
  L(dt(0, 8, 25), '张海涛', '医生', 'DEP', '储值金管理', 'DENY', '权限', 'dep.freeze', '冻结储值金', 'P001',
    null, null, '该岗位未开放此操作入口，请求被接口层拦截',
    { result: 'FAIL', failReason: '当前角色（医生）无权执行冻结储值金' })
  L(dt(0, 8, 26), '张海涛', '医生', 'MSG', '消息通知', 'DENY', '权限', 'msg.tpl', '修改短信通知模板', null,
    null, null, '该岗位未开放此操作入口，请求被接口层拦截',
    { result: 'FAIL', failReason: '当前角色（医生）无权执行修改短信通知模板' })
  L(dt(0, 8, 27), '陈静', '护士', 'APL', '手术申请', 'UPDATE', '申请单', 'APL20261109104', '曹秀珍 D2026101', 'P101',
    null, null, '该住院号已建档，不能重复建档',
    { result: 'FAIL', failReason: '该住院号已建档，不能重复建档' })
  L(dt(0, 8, 28), '王芳', '收费员', 'DEP', '储值金管理', 'UPDATE', '储值金账户', 'A101', '曹秀珍 D2026101', 'P101',
    null, null, '冻结金额不能超过可用余额 ¥3,000.00',
    { result: 'FAIL', failReason: '冻结金额不能超过可用余额 ¥3,000.00' })
  L(dt(0, 8, 29), '陈静', '护士', 'CIR', '手术报到', 'STATUS', '报到记录', 'P101', '曹秀珍 D2026101', 'P101',
    null, null, '手术日期为 ' + d(2) + '，不能提前或延后报到',
    { result: 'FAIL', failReason: '报到条件不满足：手术日期 —— 手术日期为 ' + d(2) + '，不能提前或延后报到' })

  return out
}
