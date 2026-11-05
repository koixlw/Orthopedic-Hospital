import dayjs from 'dayjs'
import { fmtDate } from '@/utils/format'
import { makeChain, diffFields } from '@/utils/audit'

// 所有日期一律相对今天生成（禁令 20）
export const TODAY = dayjs().format('YYYY-MM-DD')
export const d = (n) => dayjs().add(n, 'day').format('YYYY-MM-DD')
export const dt = (n, h, m, s = 0) =>
  dayjs().add(n, 'day').hour(h).minute(m).second(s).format('YYYY-MM-DD HH:mm:ss')

/* ---------------- 患者主数据（8 条，覆盖 8 个状态） ---------------- */
export function seedPatients() {
  return [
    {
      patientId: 'P001', name: '张建国', gender: '男', age: 58, inpatientNo: 'D2026001',
      idCard: '5101**********1234', phone: '138****6721', dept: '关节外科', bedNo: '',
      admissionCertNo: 'RJ2026001', surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001',
      plannedSurgeryDate: d(0), surgeon: '张海涛', surgeryRoom: '日间 1 间',
      diagnosis: '右膝内侧半月板损伤（Ⅲ级）', status: 'DAY_SURGERY',
      allergy: '青霉素', applyId: 'APL001', nurse: '陈静',
      evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
      admissionInfo: null, transferInfo: null, withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P002', name: '刘敏', gender: '女', age: 46, inpatientNo: 'D2026002',
      idCard: '5101**********4528', phone: '139****3306', dept: '运动医学科', bedNo: '',
      admissionCertNo: 'RJ2026002', surgeryName: '肩关节镜下肩袖修补术', surgeryCode: '83.6300',
      plannedSurgeryDate: d(2), surgeon: '周立', surgeryRoom: '日间 2 间',
      diagnosis: '右肩袖全层撕裂（冈上肌）', status: 'DAY_SURGERY',
      allergy: '无', applyId: 'APL002', nurse: '陈静',
      evalStatus: { specialist: 'PENDING', anesthesia: 'PENDING' },
      admissionInfo: null, transferInfo: null, withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P003', name: '陈国强', gender: '男', age: 62, inpatientNo: 'D2026003',
      idCard: '5101**********7719', phone: '136****8890', dept: '脊柱外科', bedNo: '',
      admissionCertNo: 'RJ2026003', surgeryName: '经皮椎间孔镜下髓核摘除术', surgeryCode: '80.5100',
      plannedSurgeryDate: d(0), surgeon: '李伟', surgeryRoom: '日间 2 间',
      diagnosis: '腰 4/5 椎间盘突出症（右侧）', status: 'SCHEDULED',
      allergy: '无', applyId: 'APL003', nurse: '陈静',
      evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
      admissionInfo: null, transferInfo: null, withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P004', name: '赵雪梅', gender: '女', age: 51, inpatientNo: 'D2026004',
      idCard: '5101**********2264', phone: '137****1128', dept: '创伤骨科', bedNo: '日间 03 床',
      admissionCertNo: 'RJ2026004', surgeryName: '骨折内固定取出术', surgeryCode: '78.6300',
      plannedSurgeryDate: d(0), surgeon: '张海涛', surgeryRoom: '日间 3 间',
      diagnosis: '右桡骨远端骨折术后（内固定存留）', status: 'ADMITTED',
      allergy: '磺胺类', applyId: 'APL006', nurse: '陈静',
      evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
      admissionInfo: {
        admissionCertNo: 'RJ2026004', bedNo: '日间 03 床', admittedAt: dt(0, 7, 40),
        guardian: '王丽', guardianPhone: '135****4412', note: '患者晨起血压 138/86', operator: '陈静'
      },
      transferInfo: null, withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P005', name: '王建军', gender: '男', age: 47, inpatientNo: 'D2026005',
      idCard: '5101**********5512', phone: '189****9031', dept: '手外科', bedNo: '日间 05 床',
      admissionCertNo: 'RJ2026005', surgeryName: '腕管切开减压术', surgeryCode: '04.4300',
      plannedSurgeryDate: d(0), surgeon: '周立', surgeryRoom: '日间 1 间',
      diagnosis: '右腕管综合征（重度）', status: 'IN_SURGERY',
      allergy: '无', applyId: 'APL007', nurse: '陈静',
      evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
      admissionInfo: {
        admissionCertNo: 'RJ2026005', bedNo: '日间 05 床', admittedAt: dt(-1, 8, 10),
        guardian: '刘芳', guardianPhone: '158****2201', note: '', operator: '陈静'
      },
      transferInfo: null, withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P006', name: '孙丽', gender: '女', age: 66, inpatientNo: 'D2026006',
      idCard: '5101**********8830', phone: '133****6677', dept: '足踝外科', bedNo: '日间 02 床',
      admissionCertNo: 'RJ2026006', surgeryName: '拇外翻截骨矫形术', surgeryCode: '77.5100',
      plannedSurgeryDate: d(-4), surgeon: '张海涛', surgeryRoom: '日间 2 间',
      diagnosis: '左足踇外翻（中重度）', status: 'DISCHARGED',
      allergy: '无', applyId: 'APL008', nurse: '陈静',
      evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
      admissionInfo: { admissionCertNo: 'RJ2026006', bedNo: '日间 02 床', admittedAt: dt(-5, 7, 55), guardian: '孙强', guardianPhone: '139****2288', note: '', operator: '陈静' },
      transferInfo: null, withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P007', name: '周晓峰', gender: '男', age: 55, inpatientNo: 'D2026007',
      idCard: '5101**********1147', phone: '135****7789', dept: '脊柱外科', bedNo: '日间 06 床',
      admissionCertNo: 'RJ2026007', surgeryName: '后路腰椎减压椎间融合术', surgeryCode: '81.0800',
      plannedSurgeryDate: d(-3), surgeon: '李伟', surgeryRoom: '日间 1 间',
      diagnosis: '腰 4/5 椎管狭窄症', status: 'TRANSFERRED',
      allergy: '无', applyId: 'APL009', nurse: '陈静',
      evalStatus: { specialist: 'PASSED', anesthesia: 'PASSED' },
      admissionInfo: { admissionCertNo: 'RJ2026007', bedNo: '日间 06 床', admittedAt: dt(-3, 8, 5), guardian: '周敏', guardianPhone: '136****5511', note: '', operator: '陈静' },
      transferInfo: {
        reason: '术式变更', method: '原床转住院', note: '椎间孔镜视野受限、减压不彻底，改行开放减压椎间融合，需继续住院观察',
        at: dt(-3, 16, 20), operator: '李伟'
      },
      transferHistory: [{ time: dt(-3, 16, 20), operator: '李伟', text: '转普通住院（术式变更 · 原床转住院）' }],
      withdrawInfo: null, statusLogs: []
    },
    {
      patientId: 'P008', name: '李桂芳', gender: '女', age: 60, inpatientNo: 'D2026008',
      idCard: '5101**********3369', phone: '130****4455', dept: '关节外科', bedNo: '',
      admissionCertNo: 'RJ2026008', surgeryName: '膝关节镜下关节清理术', surgeryCode: '80.8600',
      plannedSurgeryDate: d(-2), surgeon: '张海涛', surgeryRoom: '日间 3 间',
      diagnosis: '左膝骨关节炎（K-L Ⅲ级）', status: 'WITHDRAWN',
      allergy: '无', applyId: 'APL004', nurse: '陈静',
      evalStatus: { specialist: 'FAILED', anesthesia: 'PENDING' }, evalFailReason: '凝血功能异常',
      admissionInfo: null, transferInfo: null,
      withdrawInfo: { reason: '评估不通过', note: '凝血功能异常，INR 1.82，停用利伐沙班不足 7 天', at: dt(-2, 10, 12), operator: '陈静' },
      statusLogs: []
    }
  ]
}

/* ---------------- 储值金账户 ---------------- */
function flow(id, time, type, amount, balance, remark, operator, voided = false) {
  return { flowId: id, time, type, amount, balance, remark, operator, voided }
}

export function seedAccounts() {
  return [
    {
      accountId: 'A001', patientId: 'P001', totalDeposit: 8000, available: 8000, frozen: 0,
      inpatientDeposit: 0, consumed: 0, status: 'NORMAL', settlement: null,
      flows: [flow('F0001', dt(-6, 8, 30, 12), 'DEPOSIT', 8000, 8000, '门诊缴存日间手术专项储值金', '王芳')]
    },
    {
      accountId: 'A002', patientId: 'P002', totalDeposit: 6000, available: 0, frozen: 6000,
      inpatientDeposit: 0, consumed: 0, status: 'FROZEN', settlement: null,
      flows: [
        flow('F0011', dt(-3, 9, 12, 40), 'DEPOSIT', 6000, 6000, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0012', dt(-2, 9, 5, 18), 'FREEZE', -6000, 0, '术前检查费用记账，全额冻结', '王芳')
      ]
    },
    {
      // 陈国强已排程、储值金已全额冻结、尚未办理入院登记 —— 用于演示「入院登记」主路径
      accountId: 'A003', patientId: 'P003', totalDeposit: 8000, available: 0, frozen: 8000,
      inpatientDeposit: 0, consumed: 0, status: 'FROZEN', settlement: null,
      flows: [
        flow('F0021', dt(-5, 10, 2, 6), 'DEPOSIT', 8000, 8000, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0022', dt(-4, 8, 44, 31), 'FREEZE', -8000, 0, '术前检查费用记账，全额冻结', '王芳')
      ]
    },
    {
      accountId: 'A004', patientId: 'P004', totalDeposit: 5000, available: 0, frozen: 0,
      inpatientDeposit: 5000, consumed: 0, status: 'TRANSFERRED_IN', settlement: null,
      flows: [
        flow('F0031', dt(-4, 14, 20, 51), 'DEPOSIT', 5000, 5000, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0032', dt(-3, 9, 30, 2), 'FREEZE', -5000, 0, '术前检查费用记账，全额冻结', '王芳'),
        flow('F0033', dt(-1, 8, 12, 44), 'TRANSFER_IN', 5000, 0, '入院登记，冻结金额转入住院储值金', '陈静')
      ]
    },
    {
      accountId: 'A005', patientId: 'P005', totalDeposit: 4000, available: 0, frozen: 0,
      inpatientDeposit: 4000, consumed: 0, status: 'TRANSFERRED_IN', settlement: null,
      flows: [
        flow('F0041', dt(-4, 16, 8, 30), 'DEPOSIT', 4000, 4000, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0042', dt(-3, 8, 40, 15), 'FREEZE', -4000, 0, '术前检查费用记账，全额冻结', '王芳'),
        flow('F0043', dt(-1, 8, 20, 3), 'TRANSFER_IN', 4000, 0, '入院登记，冻结金额转入住院储值金', '陈静')
      ]
    },
    {
      accountId: 'A006', patientId: 'P006', totalDeposit: 5500, available: 0, frozen: 0,
      inpatientDeposit: 0, consumed: 960, status: 'SETTLED',
      settlement: {
        settlementNo: 'JSM20261031003', at: dt(-5, 18, 30), reason: '患者放弃手术', note: '',
        lines: [
          { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
          { name: '心电图检查', amount: 120 }, { name: '患侧关节 MRI 平扫', amount: 400 }
        ],
        total: 960, refund: 4540
      },
      flows: [
        flow('F0051', dt(-7, 9, 10, 22), 'DEPOSIT', 5500, 5500, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0052', dt(-6, 9, 22, 4), 'FREEZE', -5500, 0, '术前检查费用记账，全额冻结', '王芳'),
        flow('F0053', dt(-5, 18, 30, 45), 'SETTLE', -5500, 0, '门诊结算，扣除已产生费用 ¥960.00，退回 ¥4,540.00', '王芳')
      ]
    },
    {
      accountId: 'A007', patientId: 'P007', totalDeposit: 6500, available: 0, frozen: 0,
      inpatientDeposit: 6500, consumed: 0, status: 'TRANSFERRED_IN', settlement: null,
      flows: [
        flow('F0061', dt(-8, 11, 2, 3), 'DEPOSIT', 6500, 6500, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0062', dt(-7, 9, 40, 12), 'FREEZE', -6500, 0, '术前检查费用记账，全额冻结', '王芳'),
        flow('F0063', dt(-3, 8, 8, 55), 'TRANSFER_IN', 6500, 0, '入院登记，冻结金额转入住院储值金', '陈静')
      ]
    },
    {
      accountId: 'A008', patientId: 'P008', totalDeposit: 4500, available: 0, frozen: 0,
      inpatientDeposit: 0, consumed: 560, status: 'SETTLED',
      settlement: {
        settlementNo: 'JSM20261102001', at: dt(-2, 10, 30), reason: '评估不通过', note: '凝血功能异常，INR 1.82',
        lines: [
          { name: '血常规检验', amount: 180 }, { name: '凝血四项', amount: 260 },
          { name: '心电图检查', amount: 120 }
        ],
        total: 560, refund: 3940
      },
      flows: [
        flow('F0071', dt(-6, 10, 12, 9), 'DEPOSIT', 4500, 4500, '门诊缴存日间手术专项储值金', '王芳'),
        flow('F0072', dt(-5, 9, 12, 33), 'FREEZE', -4500, 0, '术前检查费用记账，全额冻结', '王芳'),
        flow('F0073', dt(-2, 10, 30, 5), 'SETTLE', -4500, 0, '退出日间手术，门诊结算退回 ¥3,940.00', '王芳')
      ]
    }
  ]
}

/* ---------------- 申请单 ---------------- */
export function seedApplies() {
  const base = { status: 'ARCHIVED', removed: false }
  return [
    {
      ...base, applyId: 'APL001', applyNo: 'APL20261028001', patientId: 'P001', patientName: '张建国',
      gender: '男', age: 58, inpatientNo: 'D2026001', bizMode: '手术麻醉',
      surgeryName: '膝关节镜下半月板成形术', surgeryCode: '80.6001', plannedSurgeryDate: d(0),
      surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '关节外科门诊',
      diagnosis: '右膝内侧半月板损伤（Ⅲ级）', applyDoctor: '张海涛', applyTime: dt(-7, 9, 12),
      note: '门诊 MRI 提示内侧半月板后角Ⅲ级信号，保守治疗 6 周无效'
    },
    {
      ...base, applyId: 'APL002', applyNo: 'APL20261028002', patientId: 'P002', patientName: '刘敏',
      gender: '女', age: 46, inpatientNo: 'D2026002', bizMode: '手术麻醉',
      surgeryName: '肩关节镜下肩袖修补术', surgeryCode: '83.6300', plannedSurgeryDate: d(2),
      surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '运动医学科门诊',
      diagnosis: '右肩袖全层撕裂（冈上肌）', applyDoctor: '周立', applyTime: dt(-6, 10, 5),
      note: '肩关节 MRI 示冈上肌腱全层撕裂约 12mm，拟行锚钉修补'
    },
    {
      ...base, applyId: 'APL003', applyNo: 'APL20261029003', patientId: 'P003', patientName: '陈国强',
      gender: '男', age: 62, inpatientNo: 'D2026003', bizMode: '手术麻醉',
      surgeryName: '经皮椎间孔镜下髓核摘除术', surgeryCode: '80.5100', plannedSurgeryDate: d(0),
      surgeon: '李伟', antiCoagulant: false, antiCoagStopDate: '', applyDept: '脊柱外科门诊',
      diagnosis: '腰 4/5 椎间盘突出症（右侧）', applyDoctor: '李伟', applyTime: dt(-5, 15, 32),
      note: '右下肢放射痛 3 个月，保守治疗无效，拟局麻下行椎间孔镜'
    },
    {
      ...base, applyId: 'APL004', applyNo: 'APL20261030004', patientId: 'P008', patientName: '李桂芳',
      gender: '女', age: 60, inpatientNo: 'D2026008', bizMode: '手术麻醉',
      surgeryName: '膝关节镜下关节清理术', surgeryCode: '80.8600', plannedSurgeryDate: d(-2),
      surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '关节外科门诊',
      diagnosis: '左膝骨关节炎（K-L Ⅲ级）', applyDoctor: '张海涛', applyTime: dt(-4, 11, 40), note: ''
    },
    {
      ...base, applyId: 'APL006', applyNo: 'APL20261101006', patientId: 'P004', patientName: '赵雪梅',
      gender: '女', age: 51, inpatientNo: 'D2026004', bizMode: '手术麻醉',
      surgeryName: '骨折内固定取出术', surgeryCode: '78.6300', plannedSurgeryDate: d(0),
      surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '创伤骨科门诊',
      diagnosis: '右桡骨远端骨折术后（内固定存留）', applyDoctor: '张海涛', applyTime: dt(-3, 9, 50),
      note: '术后 14 个月，X 线示骨性愈合，拟取出掌侧钢板'
    },
    {
      ...base, applyId: 'APL007', applyNo: 'APL20261101007', patientId: 'P005', patientName: '王建军',
      gender: '男', age: 47, inpatientNo: 'D2026005', bizMode: '手术不麻醉',
      surgeryName: '腕管切开减压术', surgeryCode: '04.4300', plannedSurgeryDate: d(0),
      surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '手外科门诊',
      diagnosis: '右腕管综合征（重度）', applyDoctor: '周立', applyTime: dt(-3, 10, 20),
      note: '肌电图示正中神经重度受压，拟局部浸润麻醉下松解'
    },
    {
      ...base, applyId: 'APL008', applyNo: 'APL20261029008', patientId: 'P006', patientName: '孙丽',
      gender: '女', age: 66, inpatientNo: 'D2026006', bizMode: '手术麻醉',
      surgeryName: '拇外翻截骨矫形术', surgeryCode: '77.5100', plannedSurgeryDate: d(-4),
      surgeon: '张海涛', antiCoagulant: false, antiCoagStopDate: '', applyDept: '足踝外科门诊',
      diagnosis: '左足踇外翻（中重度）', applyDoctor: '张海涛', applyTime: dt(-8, 14, 15),
      note: '踇外翻角 38°，拟行第一跖骨截骨矫形'
    },
    {
      ...base, applyId: 'APL009', applyNo: 'APL20261027009', patientId: 'P007', patientName: '周晓峰',
      gender: '男', age: 55, inpatientNo: 'D2026007', bizMode: '手术麻醉',
      surgeryName: '后路腰椎减压椎间融合术', surgeryCode: '81.0800', plannedSurgeryDate: d(-3),
      surgeon: '李伟', antiCoagulant: false, antiCoagStopDate: '', applyDept: '脊柱外科门诊',
      diagnosis: '腰 4/5 椎管狭窄症', applyDoctor: '李伟', applyTime: dt(-9, 9, 5),
      note: '间歇性跛行 200 米，影像示椎管矢状径 8mm'
    },
    {
      applyId: 'APL010', applyNo: 'APL20261105010', patientId: '', patientName: '王秀英',
      gender: '女', age: 58, inpatientNo: 'D2026012', bizMode: '手术麻醉',
      surgeryName: '肩关节镜下肩峰成形术', surgeryCode: '81.8300', plannedSurgeryDate: d(3),
      surgeon: '周立', antiCoagulant: true, antiCoagStopDate: d(-4), applyDept: '运动医学科门诊',
      diagnosis: '右肩峰下撞击综合征', applyDoctor: '周立', applyTime: dt(-1, 14, 20),
      note: '长期口服华法林，需确认停药天数', status: 'PENDING'
    },
    {
      applyId: 'APL011', applyNo: 'APL20261105011', patientId: '', patientName: '杨志远',
      gender: '男', age: 35, inpatientNo: 'D2026013', bizMode: '手术不麻醉',
      surgeryName: '腱鞘囊肿切除术', surgeryCode: '82.2900', plannedSurgeryDate: d(1),
      surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '', applyDept: '手外科门诊',
      diagnosis: '左腕背腱鞘囊肿', applyDoctor: '周立', applyTime: dt(0, 8, 10), note: '', status: 'PENDING'
    }
  ]
}

// HIS 待接收池（只从 api/his.js 读取，不进 store）
export function seedApplyPool() {
  return [
    {
      applyNo: 'APL20261103005', patientName: '吴建华', gender: '男', age: 64, inpatientNo: 'D2026009',
      bizMode: '手术麻醉', surgeryName: '经皮椎体成形术（PKP）', surgeryCode: '81.6500',
      plannedSurgeryDate: d(5), surgeon: '李伟', antiCoagulant: true, antiCoagStopDate: d(-4),
      applyDept: '脊柱外科门诊', applyDoctor: '李伟', applyTime: dt(-1, 9, 20),
      diagnosis: '腰 1 椎体骨质疏松性压缩骨折',
      idCard: '5101**********9912', phone: '138****2290'
    },
    {
      applyNo: 'APL20261104006', patientName: '郑小燕', gender: '女', age: 39, inpatientNo: 'D2026010',
      bizMode: '手术不麻醉', surgeryName: '腱鞘囊肿切除术', surgeryCode: '82.2900',
      plannedSurgeryDate: d(4), surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '',
      applyDept: '手外科门诊', applyDoctor: '周立', applyTime: dt(0, 8, 45),
      diagnosis: '右腕背腱鞘囊肿',
      idCard: '5101**********3388', phone: '139****6677'
    },
    {
      applyNo: 'APL20261104007', patientName: '何志强', gender: '男', age: 52, inpatientNo: 'D2026011',
      bizMode: '麻醉不手术', surgeryName: '麻醉下肩关节腔穿刺注射治疗', surgeryCode: '81.9200',
      plannedSurgeryDate: d(3), surgeon: '周立', antiCoagulant: false, antiCoagStopDate: '',
      applyDept: '运动医学科门诊', applyDoctor: '周立', applyTime: dt(0, 10, 12),
      diagnosis: '右肩关节粘连性关节囊炎（冻结肩）',
      idCard: '5101**********5566', phone: '137****9900'
    }
  ]
}

/* ---------------- 评估记录 ---------------- */
export function seedEvals() {
  const base = { reason: '', reasonNote: '', asa: '', anesthesiaMethod: '', riskNote: '', voided: false }
  return [
    { ...base, evalId: 'EVL001', patientId: 'P001', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-4, 10, 12) },
    { ...base, evalId: 'EVL002', patientId: 'P001', type: 'ANESTHESIA', conclusion: 'PASSED', asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '轻度高血压，术中控制性降压，术后镇痛泵', doctor: '罗建平', time: dt(-4, 11, 5) },
    { ...base, evalId: 'EVL003', patientId: 'P003', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '李伟', time: dt(-3, 9, 30) },
    { ...base, evalId: 'EVL004', patientId: 'P003', type: 'ANESTHESIA', conclusion: 'PASSED', asa: 'ASA I', anesthesiaMethod: '局部浸润麻醉', riskNote: '局麻+镇静，术中唤醒确认下肢肌力', doctor: '罗建平', time: dt(-3, 10, 2) },
    { ...base, evalId: 'EVL005', patientId: 'P004', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '张海涛', time: dt(-2, 14, 20) },
    { ...base, evalId: 'EVL006', patientId: 'P004', type: 'ANESTHESIA', conclusion: 'PASSED', asa: 'ASA II', anesthesiaMethod: '神经阻滞', riskNote: '超声引导下肌间沟臂丛阻滞，备全麻', doctor: '罗建平', time: dt(-2, 15, 10) },
    { ...base, evalId: 'EVL007', patientId: 'P008', type: 'SPECIALIST', conclusion: 'FAILED', reason: '凝血功能异常', reasonNote: 'INR 1.82，停用利伐沙班不足 7 天，不符合日间手术准入标准', doctor: '张海涛', time: dt(-2, 9, 40) },
    { ...base, evalId: 'EVL008', patientId: 'P005', type: 'SPECIALIST', conclusion: 'PASSED', doctor: '周立', time: dt(-3, 9, 10) },
    { ...base, evalId: 'EVL009', patientId: 'P005', type: 'ANESTHESIA', conclusion: 'PASSED', asa: 'ASA I', anesthesiaMethod: '局部浸润麻醉', riskNote: '局部浸润麻醉，无需禁食', doctor: '罗建平', time: dt(-3, 9, 50) }
  ]
}

/* ---------------- 排程 ---------------- */
export function seedSchedules() {
  return [
    {
      scheduleId: 'SCH00000001', patientId: 'P003', surgeryDate: d(0), room: '日间 2 间', seq: 2,
      surgeon: '李伟', anesthesiologist: '罗建平', anesthesiaType: '局部浸润麻醉', status: 'SCHEDULED',
      bookedDate: d(0), bookedRoom: '日间 2 间', bookedSeq: 2, bookedSurgeon: '李伟',
      isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
    },
    {
      scheduleId: 'SCH00000002', patientId: 'P004', surgeryDate: d(0), room: '日间 3 间', seq: 1,
      surgeon: '张海涛', anesthesiologist: '罗建平', anesthesiaType: '神经阻滞', status: 'SCHEDULED',
      bookedDate: d(0), bookedRoom: '日间 3 间', bookedSeq: 1, bookedSurgeon: '张海涛',
      isChanged: false, changeCount: 0, changeLogs: [], cancelReason: ''
    },
    {
      scheduleId: 'SCH00000003', patientId: 'P007', surgeryDate: d(-3), room: '日间 1 间', seq: 1,
      surgeon: '李伟', anesthesiologist: '罗建平', anesthesiaType: '全身麻醉', status: 'COMPLETED',
      bookedDate: d(-4), bookedRoom: '日间 1 间', bookedSeq: 1, bookedSurgeon: '李伟',
      isChanged: true, changeCount: 2,
      changeLogs: [
        { time: dt(-5, 16, 10), operator: '陈静', reason: '手术室临时调整', text: `${d(-4)} 日间 1 间 第 1 台 → ${d(-3)} 日间 1 间 第 1 台` }
      ],
      cancelReason: ''
    }
  ]
}

export function seedCheckins() {
  return []
}

/* ---------------- 通知 ---------------- */
export function seedMessages() {
  return [
    {
      msgId: 'MSG001', patientId: 'P003', type: 'APPOINTMENT_SUCCESS', channel: '短信',
      phone: '136****8890', status: 'SENT', planSendTime: dt(-1, 9, 15), sendTime: dt(-1, 9, 15, 22),
      resendCount: 0, trigger: '创建手术预约 SCH00000001', content:
        '【日间手术中心】陈国强您好，您的手术已预约成功：' + d(0) + ' 日间 2 间 第 2 台，主刀 李伟，麻醉方式为局部浸润麻醉。请于当日 07:30 前到日间手术中心报到，术前 8 小时禁食、4 小时禁饮，并携带近期腰椎 MRI 片。如需改期请联系 028-8888 6120。'
    },
    {
      msgId: 'MSG002', patientId: 'P004', type: 'PRE_ADMISSION', channel: '短信',
      phone: '137****1128', status: 'SENT', planSendTime: dt(-1, 9, 0), sendTime: dt(-1, 9, 0, 8),
      resendCount: 0, trigger: '入院前提醒（提前 1 天）', content:
        '【日间手术中心】赵雪梅您好，您预约的手术时间为' + d(0) + '，请于当日上午 07:30 前到日间手术中心办理入院，携带身份证、医保卡、住院证及右腕 X 线片。术前 8 小时禁食、4 小时禁饮。'
    },
    {
      msgId: 'MSG003', patientId: 'P007', type: 'SCHEDULE_CHANGE', channel: '短信',
      phone: '135****7789', status: 'SENT', planSendTime: dt(-5, 16, 10), sendTime: dt(-5, 16, 10, 40),
      resendCount: 0, trigger: '调整手术安排 SCH00000003', content:
        '【日间手术中心】周晓峰您好，您的手术时间已调整：原定 ' + d(-4) + ' 日间 1 间 第 1 台，调整为 ' + d(-3) + ' 日间 1 间 第 1 台，请按新时间到院，术前 8 小时禁食。'
    },
    {
      msgId: 'MSG004', patientId: 'P002', type: 'PRE_ADMISSION', channel: '短信',
      phone: '139****3306', status: 'FAILED', planSendTime: dt(1, 9, 0), sendTime: '',
      resendCount: 0, failReason: '网关返回：号码状态异常（空号/停机）',
      trigger: '入院前提醒（提前 1 天）', content:
        '【日间手术中心】刘敏您好，您的手术时间为' + d(2) + '，请于前一日上午到日间手术中心完成术前准备，携带肩关节 MRI 片。'
    },
    {
      msgId: 'MSG005', patientId: 'P001', type: 'PRE_ADMISSION', channel: '短信',
      phone: '138****6721', status: 'PENDING', planSendTime: dt(0, 9, 0), sendTime: '',
      resendCount: 0, trigger: '入院前提醒（提前 1 天）', content:
        '【日间手术中心】张建国您好，您预约的手术时间为' + d(0) + '，请于当日上午 07:30 前到日间手术中心办理入院，术前 8 小时禁食，请携带膝关节 MRI 片。'
    }
  ]
}

/* ---------------- 系统参数 ---------------- */
export function seedSettings() {
  return {
    preAdmissionNoticeDays: 1,
    autoSendAppointmentSms: true,
    changeNoticeChannel: 'BOTH',
    fastingTip: '术前 8 小时禁食、4 小时禁饮；请提前取下义齿与饰品，术晨勿化妆，并携带患肢 X 线 / MRI 影像资料。'
  }
}

/* ---------------- 字典 ---------------- */
export function seedChargeItems() {
  return [
    { code: '310101', name: '膝关节镜下半月板成形术', spec: '次', unit: '次', price: 3200, category: '手术费', enabled: true },
    { code: '310102', name: '肩关节镜下肩袖修补术', spec: '次', unit: '次', price: 5600, category: '手术费', enabled: true },
    { code: '310103', name: '骨折内固定取出术', spec: '次', unit: '次', price: 1800, category: '手术费', enabled: true },
    { code: '310104', name: '腕管切开减压术', spec: '次', unit: '次', price: 1600, category: '手术费', enabled: true },
    { code: '310105', name: '麻醉操作技术费', spec: '次', unit: '次', price: 200, category: '手术费', enabled: true },
    { code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', price: 800, category: '麻醉费', enabled: true },
    { code: '310202', name: '神经阻滞麻醉（超声引导）', spec: '次', unit: '次', price: 560, category: '麻醉费', enabled: true },
    { code: '310203', name: '局部浸润麻醉', spec: '次', unit: '次', price: 180, category: '麻醉费', enabled: true },
    { code: '310204', name: '麻醉气体监测', spec: '小时', unit: '小时', price: 120, category: '麻醉费', enabled: true },
    { code: '310301', name: '一次性使用关节镜刨削刀头', spec: '4.0mm', unit: '个', price: 260, category: '材料费', enabled: true },
    { code: '310302', name: '射频等离子消融电极', spec: '标准型', unit: '支', price: 120, category: '材料费', enabled: true },
    { code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', price: 100, category: '材料费', enabled: true },
    { code: '310304', name: '一次性使用麻醉穿刺包', spec: '常规', unit: '套', price: 100, category: '材料费', enabled: true },
    { code: '310305', name: '一次性使用带线锚钉', spec: '5.5mm', unit: '枚', price: 2100, category: '材料费', enabled: true },
    { code: '310401', name: '注射用头孢呋辛钠', spec: '1.5g', unit: '支', price: 56, category: '药品费', enabled: true },
    { code: '310402', name: '0.9% 氯化钠注射液', spec: '500ml', unit: '瓶', price: 24, category: '药品费', enabled: true },
    { code: '310403', name: '丙泊酚注射液', spec: '20ml:0.2g', unit: '支', price: 96, category: '药品费', enabled: true },
    { code: '310404', name: '注射用瑞芬太尼', spec: '1mg', unit: '支', price: 88, category: '药品费', enabled: true },
    { code: '310405', name: '咪达唑仑注射液', spec: '2ml:10mg', unit: '支', price: 76, category: '药品费', enabled: true },
    { code: '310406', name: '乳酸林格氏液', spec: '500ml', unit: '瓶', price: 28, category: '药品费', enabled: true },
    { code: '310407', name: '氨甲环酸注射液', spec: '5ml:0.5g', unit: '支', price: 68, category: '药品费', enabled: true }
  ]
}

export function seedDrugs() {
  return [
    { code: 'D0001', name: '丙泊酚注射液', spec: '20ml:0.2g', dose: 120, unit: 'mg', usage: '静注', isAnesthetic: true, enabled: true },
    { code: 'D0002', name: '注射用瑞芬太尼', spec: '1mg', dose: 1, unit: 'mg', usage: '静滴', isAnesthetic: true, enabled: true },
    { code: 'D0003', name: '苯磺顺阿曲库铵注射液', spec: '5ml:10mg', dose: 10, unit: 'mg', usage: '静注', isAnesthetic: true, enabled: true },
    { code: 'D0004', name: '咪达唑仑注射液', spec: '2ml:10mg', dose: 5, unit: 'mg', usage: '静注', isAnesthetic: true, enabled: true },
    { code: 'D0005', name: '盐酸利多卡因注射液', spec: '5ml:0.1g', dose: 100, unit: 'mg', usage: '局部浸润', isAnesthetic: true, enabled: true },
    { code: 'D0006', name: '注射用盐酸昂丹司琼', spec: '8mg', dose: 8, unit: 'mg', usage: '静注', isAnesthetic: false, enabled: true },
    { code: 'D0007', name: '注射用头孢呋辛钠', spec: '1.5g', dose: 1.5, unit: 'g', usage: '静滴', isAnesthetic: false, enabled: true },
    { code: 'D0008', name: '0.9% 氯化钠注射液', spec: '500ml', dose: 500, unit: 'ml', usage: '静滴', isAnesthetic: false, enabled: true },
    { code: 'D0009', name: '乳酸林格氏液', spec: '500ml', dose: 500, unit: 'ml', usage: '静滴', isAnesthetic: false, enabled: true },
    { code: 'D0010', name: '注射用泮托拉唑钠', spec: '40mg', dose: 40, unit: 'mg', usage: '静滴', isAnesthetic: false, enabled: true },
    { code: 'D0011', name: '地塞米松磷酸钠注射液', spec: '1ml:5mg', dose: 5, unit: 'mg', usage: '静注', isAnesthetic: false, enabled: true },
    { code: 'D0012', name: '盐酸曲马多注射液', spec: '2ml:0.1g', dose: 100, unit: 'mg', usage: '肌注', isAnesthetic: false, enabled: true },
    { code: 'D0013', name: '盐酸罗哌卡因注射液', spec: '10ml:100mg', dose: 100, unit: 'mg', usage: '神经阻滞', isAnesthetic: true, enabled: true },
    { code: 'D0014', name: '氨甲环酸注射液', spec: '5ml:0.5g', dose: 0.5, unit: 'g', usage: '静滴', isAnesthetic: false, enabled: true },
    { code: 'D0015', name: '注射用帕瑞昔布钠', spec: '40mg', dose: 40, unit: 'mg', usage: '静注', isAnesthetic: false, enabled: true }
  ]
}

export function seedGroups() {
  return [
    {
      groupId: 'G001', name: '膝关节镜常用组套', enabled: true,
      lines: [
        { code: '310101', name: '膝关节镜下半月板成形术', spec: '次', unit: '次', qty: 1, price: 3200 },
        { code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 800 },
        { code: '310204', name: '麻醉气体监测', spec: '小时', unit: '小时', qty: 1, price: 120 },
        { code: '310301', name: '一次性使用关节镜刨削刀头', spec: '4.0mm', unit: '个', qty: 1, price: 260 },
        { code: '310302', name: '射频等离子消融电极', spec: '标准型', unit: '支', qty: 1, price: 120 },
        { code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 1, price: 100 },
        { code: '310401', name: '注射用头孢呋辛钠', spec: '1.5g', unit: '支', qty: 1, price: 56 },
        { code: '310402', name: '0.9% 氯化钠注射液', spec: '500ml', unit: '瓶', qty: 1, price: 24 }
      ],
      total: 4680
    },
    {
      groupId: 'G002', name: '日间手术麻醉组套', enabled: true,
      lines: [
        { code: '310105', name: '麻醉操作技术费', spec: '次', unit: '次', qty: 1, price: 200 },
        { code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 700 },
        { code: '310304', name: '一次性使用麻醉穿刺包', spec: '常规', unit: '套', qty: 1, price: 100 },
        { code: '310403', name: '丙泊酚注射液', spec: '20ml:0.2g', unit: '支', qty: 1, price: 96 },
        { code: '310404', name: '注射用瑞芬太尼', spec: '1mg', unit: '支', qty: 1, price: 88 },
        { code: '310405', name: '咪达唑仑注射液', spec: '2ml:10mg', unit: '支', qty: 1, price: 76 }
      ],
      total: 1260
    },
    {
      groupId: 'G003', name: '肩袖修补常用组套', enabled: true,
      lines: [
        { code: '310102', name: '肩关节镜下肩袖修补术', spec: '次', unit: '次', qty: 1, price: 5600 },
        { code: '310201', name: '全身麻醉（2 小时以内）', spec: '次', unit: '次', qty: 1, price: 800 },
        { code: '310305', name: '一次性使用带线锚钉', spec: '5.5mm', unit: '枚', qty: 2, price: 2100 },
        { code: '310301', name: '一次性使用关节镜刨削刀头', spec: '4.0mm', unit: '个', qty: 1, price: 260 },
        { code: '310303', name: '医用可吸收缝合线', spec: '3-0', unit: '根', qty: 2, price: 100 },
        { code: '310401', name: '注射用头孢呋辛钠', spec: '1.5g', unit: '支', qty: 1, price: 56 }
      ],
      total: 11116
    }
  ]
}

export function seedEvalReasons() {
  return [
    { code: 'R01', name: '凝血功能异常', enabled: true },
    { code: 'R02', name: '心肺功能不全', enabled: true },
    { code: 'R03', name: '血糖控制不佳', enabled: true },
    { code: 'R04', name: '感染未控制', enabled: true },
    { code: 'R05', name: '麻醉风险评估过高', enabled: true },
    { code: 'R06', name: '其他', enabled: true }
  ]
}

/* ---------------- 检查项目与报告 ---------------- */
const REPORT_TEXT = {
  血常规: {
    source: 'LIS', doctor: '李静', reviewer: '王强',
    items: [
      { itemName: '白细胞计数', result: '6.2', unit: '10^9/L', refRange: '3.5—9.5', abnormal: false },
      { itemName: '红细胞计数', result: '4.58', unit: '10^12/L', refRange: '4.3—5.8', abnormal: false },
      { itemName: '血红蛋白', result: '128', unit: 'g/L', refRange: '115—150', abnormal: false },
      { itemName: '血小板计数', result: '210', unit: '10^9/L', refRange: '125—350', abnormal: false }
    ]
  },
  凝血四项: {
    source: 'LIS', doctor: '李静', reviewer: '王强',
    items: [
      { itemName: '凝血酶原时间 PT', result: '12.4', unit: 's', refRange: '11—14.5', abnormal: false },
      { itemName: '国际标准化比值 INR', result: '1.02', unit: '', refRange: '0.8—1.2', abnormal: false },
      { itemName: '活化部分凝血活酶时间 APTT', result: '33.6', unit: 's', refRange: '28—45', abnormal: false },
      { itemName: '纤维蛋白原 FIB', result: '3.12', unit: 'g/L', refRange: '2—4', abnormal: false }
    ]
  },
  心电图: {
    source: 'PACS', doctor: '陈涛', reviewer: '王强',
    items: [
      { itemName: '心率', result: '76', unit: '次/分', refRange: '60—100', abnormal: false },
      { itemName: 'PR 间期', result: '162', unit: 'ms', refRange: '120—200', abnormal: false },
      { itemName: 'QRS 时限', result: '94', unit: 'ms', refRange: '60—110', abnormal: false },
      { itemName: 'ST-T 改变', result: '未见异常', unit: '', refRange: '未见异常', abnormal: false }
    ]
  },
  '患侧关节 X 线正侧位': {
    source: 'PACS', doctor: '刘洋', reviewer: '王强',
    items: [
      { itemName: '骨质连续性', result: '连续', unit: '', refRange: '连续', abnormal: false },
      { itemName: '关节间隙', result: '内侧稍窄', unit: 'mm', refRange: '3—5', abnormal: true },
      { itemName: '游离体 / 内固定', result: '未见', unit: '', refRange: '未见', abnormal: false },
      { itemName: '周围软组织', result: '未见明显肿胀', unit: '', refRange: '无肿胀', abnormal: false }
    ]
  }
}

export function seedExams(patientId) {
  const later = patientId === 'P002'
  return [
    {
      examId: 'EX' + patientId + '1', name: '血常规', type: '检验', bookStatus: '已完成',
      bookTime: dt(-5, 8, 30), reportStatus: '已出', reportTime: dt(-5, 10, 12), source: 'LIS',
      report: REPORT_TEXT['血常规']
    },
    {
      examId: 'EX' + patientId + '2', name: '凝血四项', type: '检验', bookStatus: '已完成',
      bookTime: dt(-5, 8, 30), reportStatus: '已出', reportTime: dt(-5, 10, 40), source: 'LIS',
      report: REPORT_TEXT['凝血四项']
    },
    {
      examId: 'EX' + patientId + '3', name: '心电图', type: '检查', bookStatus: '已完成',
      bookTime: dt(-4, 9, 0), reportStatus: '已出', reportTime: dt(-4, 9, 26), source: 'PACS',
      report: REPORT_TEXT['心电图']
    },
    {
      examId: 'EX' + patientId + '4', name: '患侧关节 X 线正侧位', type: '检查',
      bookStatus: later ? '已预约' : '已完成',
      bookTime: later ? d(1) + ' 09:00' : dt(-4, 9, 40),
      reportStatus: later ? '未出' : '已出',
      reportTime: later ? '' : dt(-4, 11, 8),
      source: 'PACS', report: later ? null : REPORT_TEXT['患侧关节 X 线正侧位']
    }
  ]
}

/* ---------------- 费用与医嘱预置 ---------------- */
export function seedCharges() {
  return [
    {
      chargeId: 'CJ20261102001', patientId: 'P004', status: 'SUBMITTED', groupName: '骨折内固定取出常用组套',
      lines: [
        { chargeItemId: 'FI0001', code: '310103', name: '骨折内固定取出术', spec: '次', unit: '次', qty: 1, price: 1800, amount: 1800, removed: false },
        { chargeItemId: 'FI0002', code: '310202', name: '神经阻滞麻醉（超声引导）', spec: '次', unit: '次', qty: 1, price: 560, amount: 560, removed: false },
        { chargeItemId: 'FI0003', code: '310302', name: '射频等离子消融电极', spec: '标准型', unit: '支', qty: 1, price: 120, amount: 120, removed: true, removeReason: '重复录入', removedBy: '张海涛', removedAt: dt(-1, 11, 20) },
        { chargeItemId: 'FI0004', code: '310304', name: '一次性使用麻醉穿刺包', spec: '常规', unit: '套', qty: 1, price: 100, amount: 100, removed: false }
      ],
      total: 2460, submittedAt: dt(-1, 11, 32), submittedBy: '张海涛',
      voidReason: '', voidedAt: ''
    }
  ]
}

export function seedOrders() {
  return [
    {
      orderId: 'ORD0001', patientId: 'P004', type: '临时', drugCode: 'D0013', drugName: '盐酸罗哌卡因注射液',
      spec: '10ml:100mg', dose: 100, unit: 'mg', usage: '神经阻滞', freq: '一次', startTime: dt(-1, 10, 20),
      doctor: '张海涛', isAnesthetic: true, execStatus: '已执行', stopTime: '', voidReason: '', removed: false
    },
    {
      orderId: 'ORD0002', patientId: 'P004', type: '临时', drugCode: 'D0014', drugName: '氨甲环酸注射液',
      spec: '5ml:0.5g', dose: 0.5, unit: 'g', usage: '静滴', freq: '一次', startTime: dt(-1, 10, 25),
      doctor: '张海涛', isAnesthetic: false, execStatus: '执行中', stopTime: '', voidReason: '', removed: false
    },
    {
      orderId: 'ORD0003', patientId: 'P004', type: '临时', drugCode: 'D0015', drugName: '注射用帕瑞昔布钠',
      spec: '40mg', dose: 40, unit: 'mg', usage: '静注', freq: 'q12h', startTime: dt(-1, 10, 30),
      doctor: '张海涛', isAnesthetic: false, execStatus: '执行中', stopTime: '', voidReason: '', removed: false
    }
  ]
}

/* ---------------- 预置操作日志（九要素齐全，时间跨 7 天） ---------------- */
function mkLog(seq, time, operator, role, module, page, action, targetType, targetId, targetName, patientId, before, after, reason) {
  return Object.freeze({
    seq, logId: 'LOG' + String(seq).padStart(8, '0'), time, operator, role, module, page, action,
    targetType, targetId, targetName, patientId, before: before || null, after: after || null,
    diff: before && after ? diffFields(before, after) : [],
    reason: reason || '', result: 'SUCCESS', failReason: '',
    client: 'Web / Chrome / 192.168.10.24', chain: makeChain(seq, time, targetId, after)
  })
}

export function seedLogs() {
  return [
    mkLog(1, dt(-7, 9, 12, 5), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL001', '张建国 D2026001', 'P001', null, { 申请单号: 'APL20261028001', 业务模式: '手术麻醉' }, '接收 HIS 日间手术申请单'),
    mkLog(2, dt(-6, 8, 42, 18), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'P001', '张建国 D2026001', 'P001', null, { 住院号: 'D2026001', 患者状态: '术前准备' }, '从申请单建档'),
    mkLog(3, dt(-6, 8, 30, 12), '王芳', '收费员', 'DEP', '储值金', 'CREATE', '储值金流水', 'F0001', '张建国 D2026001', 'P001', null, { 发生金额: '8,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金'),
    mkLog(4, dt(-5, 11, 2, 30), '陈静', '护士', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL001', '张建国 专科评估', 'P001', null, { 结论: '通过', 评估类型: '专科评估' }, '术前检查报告齐全，准予进入日间手术流程'),
    mkLog(5, dt(-4, 11, 5, 12), '李伟', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL002', '张建国 麻醉评估', 'P001', null, { 结论: '通过', ASA: 'ASA II' }, '麻醉评估通过，建议全身麻醉'),
    mkLog(6, dt(-4, 10, 12, 44), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL001', '张建国 专科评估', 'P001', null, { 结论: '通过' }, '专科评估通过'),
    mkLog(7, dt(-5, 16, 10, 8), '陈静', '护士', 'SCH', '手术排程', 'UPDATE', '手术排程', 'SCH00000003', '周晓峰 D2026007', 'P007',
      { 手术日期: d(-4), 台次: '第 1 台' }, { 手术日期: d(-3), 台次: '第 1 台' }, '手术室临时调整，已发送变更通知'),
    mkLog(8, dt(-2, 9, 40, 22), '张海涛', '医生', 'EVL', '术前评估', 'CREATE', '术前评估', 'EVL007', '李桂芳 专科评估', 'P008', null, { 结论: '不通过', 原因: '凝血功能异常' }, 'INR 1.82，不符合日间手术准入标准'),
    mkLog(9, dt(-1, 9, 15, 9), '陈静', '护士', 'MSG', '消息通知', 'CREATE', '通知', 'MSG001', '陈国强 预约成功', 'P003', null, { 类型: '预约成功', 渠道: '短信' }, '创建手术预约后自动发送'),
    // 陈国强（P003）完整留痕链：接收申请 → 建档 → 缴存 → 冻结 → 排程
    mkLog(10, dt(-6, 10, 8, 36), '陈静', '护士', 'APL', '手术申请', 'CREATE', '申请单', 'APL003', '陈国强 D2026003', 'P003', null, { 申请单号: 'APL20261029003', 业务模式: '手术麻醉' }, '接收 HIS 日间手术申请单'),
    mkLog(11, dt(-6, 10, 26, 4), '陈静', '护士', 'BAS', '工作台', 'CREATE', '患者', 'P003', '陈国强 D2026003', 'P003', null, { 住院号: 'D2026003', 患者状态: '术前准备' }, '从申请单建档'),
    mkLog(12, dt(-5, 10, 2, 6), '王芳', '收费员', 'DEP', '储值金', 'CREATE', '储值金流水', 'F0021', '陈国强 D2026003', 'P003', null, { 发生金额: '8,000.00', 业务类型: '缴存' }, '门诊缴存日间手术专项储值金'),
    mkLog(13, dt(-4, 8, 44, 31), '王芳', '收费员', 'DEP', '储值金', 'UPDATE', '储值金账户', 'A003', '陈国强 D2026003', 'P003',
      { 可用余额: '¥8,000.00', 冻结金额: '¥0.00' }, { 可用余额: '¥0.00', 冻结金额: '¥8,000.00' }, '术前检查费用记账，全额冻结'),
    mkLog(14, dt(-3, 15, 21, 47), '陈静', '护士', 'SCH', '手术排程', 'CREATE', '手术排程', 'SCH00000001', '陈国强 D2026003', 'P003', null, { 手术日期: d(0), 手术间: '日间 2 间', 台次: '第 2 台', 主刀: '李伟' }, '确认术前评估通过后安排手术排程'),
    // 张建国（P001）后续两条：入院前提醒 + 术前准备完成，使主路径患者轨迹可追溯 8 个节点
    mkLog(15, dt(-2, 16, 30, 12), '陈静', '护士', 'MSG', '消息通知', 'CREATE', '通知', 'MSG005', '张建国 入院前提醒', 'P001', null, { 类型: '入院前提醒', 渠道: '短信', 内容: '术前 8 小时禁食' }, '按系统参数「入院前提醒天数」自动生成'),
    mkLog(16, dt(-1, 10, 5, 33), '陈静', '护士', 'BAS', '工作台', 'UPDATE', '患者', 'P001', '张建国 D2026001', 'P001',
      { 患者状态: '已申请' }, { 患者状态: '术前准备', 术前评估: '专科通过 / 麻醉通过' }, '术前检查与评估完成，转入术前准备')
  ]
}

export const CHARGE_CATEGORIES = ['手术费', '麻醉费', '材料费', '药品费']
export const SURGERY_ROOMS = ['日间 1 间', '日间 2 间', '日间 3 间']
export const SURGERY_SEQS = [1, 2, 3]
export const ANESTHESIA_TYPES = ['全身麻醉', '椎管内麻醉', '神经阻滞', '局部浸润麻醉']
export const BIZ_MODES = ['手术麻醉', '手术不麻醉', '麻醉不手术']
export const TRANSFER_REASONS = ['病情变化需继续治疗', '术式变更', '术后出现并发症', '患者及家属要求', '其他']
export const TRANSFER_METHODS = ['原床转住院', '转科', '重新开具住院证']
export const WITHDRAW_REASONS = ['评估不通过', '患者放弃手术', '其他原因']
export const CANCEL_REASONS = ['患者放弃手术', '评估需复评', '手术室资源调整', '其他']
export const VOID_REASONS = ['组套选错', '重复录入', '患者取消手术', '其他']
export const REVERSE_REASONS = ['患者退费', '金额录入错误', '重复缴存', '其他']
export const USAGES = ['静注', '静滴', '肌注', '口服', '局部浸润']
export const FREQS = ['一次', '术中维持', 'q8h', 'q12h', 'qd']

export const PATIENT_STATUS = {
  APPLIED: { label: '已申请', type: 'info' },
  DAY_SURGERY: { label: '术前准备', type: 'primary' },
  SCHEDULED: { label: '已排程', type: 'primary' },
  ADMITTED: { label: '已入院', type: 'success' },
  IN_SURGERY: { label: '术中', type: 'warning' },
  TRANSFERRED: { label: '普通住院', type: 'warning' },
  DISCHARGED: { label: '已出院', type: 'info' },
  WITHDRAWN: { label: '已退出', type: 'info' }
}

export const ACCOUNT_STATUS = {
  NORMAL: { label: '正常', type: 'success' },
  FROZEN: { label: '已冻结', type: 'warning' },
  TRANSFERRED_IN: { label: '已转入住院', type: 'primary' },
  SETTLED: { label: '已结算', type: 'info' }
}

export const FLOW_TYPE = {
  DEPOSIT: '缴存', FREEZE: '冻结', TRANSFER_IN: '转住院', SETTLE: '门诊结算', REVERSE: '冲正'
}

export const todayStr = () => fmtDate(new Date())
