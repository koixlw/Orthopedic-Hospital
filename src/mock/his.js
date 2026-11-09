// 本地模拟 HIS：申请单池 + 患者档案 + 检查报告
// 只读、不回写（SIM-001）；页面不直接引用本文件（SIM-002）
import { state } from '@/store/db'
import { seedApplyPool, seedPatients, seedExams, cardTypeOf, cardNoOf } from './dict'

const DELAY = 800
const clone = (x) => JSON.parse(JSON.stringify(x))
const later = (fn) => new Promise((resolve, reject) => {
  setTimeout(() => {
    try { resolve(fn()) } catch (e) { reject(e) }
  }, DELAY)
})

export function fetchApplyPool() {
  return later(() => {
    const received = new Set(state.applies.map((a) => a.applyNo))
    const list = seedApplyPool().filter((x) => !received.has(x.applyNo))
    return { list: clone(list), source: 'HIS 诊间申请单表（模拟）', readAt: new Date().toISOString() }
  })
}

/**
 * 待接收申请单数量：用于「接收 HIS 申请单」按钮与侧栏「日间手术申请」的角标提醒
 * 不走 800ms 模拟延时，避免按钮在打开页面时长时间不可点
 */
export function fetchApplyPoolCount() {
  const received = new Set(state.applies.map((a) => a.applyNo))
  const count = seedApplyPool().filter((x) => !received.has(x.applyNo)).length
  return { count, readAt: new Date().toISOString() }
}

export function fetchPatientArchive(inpatientNo) {
  return later(() => {
    if (!inpatientNo) throw new Error('请输入住院号')
    const p = state.patients.find((x) => x.inpatientNo === inpatientNo.trim())
    if (!p) {
      const master = seedPatients().find((x) => x.inpatientNo === inpatientNo.trim())
      if (master) throw new Error('该住院号尚未在本系统建档，请先在「手术申请」页接收申请单')
      throw new Error('未查询到该住院号的患者信息')
    }
    const examList = seedExams(p.patientId)
    return clone({
      patient: {
        patientId: p.patientId, name: p.name, gender: p.gender, age: p.age,
        inpatientNo: p.inpatientNo, idCard: p.idCard, phone: p.phone, dept: p.dept,
        allergy: p.allergy
      },
      admissionCert: {
        admissionCertNo: p.admissionCertNo, diagnosis: p.diagnosis,
        surgeryName: p.surgeryName, plannedSurgeryDate: p.plannedSurgeryDate,
        surgeon: p.surgeon, surgeryRoom: p.surgeryRoom
      },
      reports: examList.filter((e) => e.reportStatus === '已出').map((e) => ({
        reportName: e.name, reportTime: e.reportTime, source: e.source,
        items: e.report.items, doctor: e.report.doctor, reviewer: e.report.reviewer
      })),
      exams: examList,
      readAt: new Date().toISOString()
    })
  })
}

/**
 * 刷卡读取患者：招标第 11 项「刷医保卡/就诊卡/身份证」
 * @param {string} cardType MEDICAL_CARD | VISIT_CARD | ID_CARD
 * @param {string} cardNo  读卡器读到的卡号 / 证件号
 */
export function fetchPatientByCard(cardType, cardNo) {
  return later(() => {
    const t = cardTypeOf(cardType)
    const no = (cardNo || '').trim()
    if (!no) throw new Error(`读卡器未读到${t.label}，请重新刷卡`)
    const p = state.patients.find((x) => cardNoOf(x, t.value) === no)
    if (!p) throw new Error(`未读到该${t.label}对应的患者信息，请核对${t.noLabel}或更换刷卡方式`)
    return clone({
      cardType: t.value, cardLabel: t.label, cardNo: no,
      patient: {
        patientId: p.patientId, name: p.name, gender: p.gender, age: p.age,
        inpatientNo: p.inpatientNo, idCard: p.idCard, phone: p.phone, dept: p.dept
      },
      readAt: new Date().toISOString()
    })
  })
}

export function fetchExamReports(patientId) {
  return later(() => {
    if (!patientId) throw new Error('缺少患者标识')
    const list = seedExams(patientId)
    const done = list.filter((e) => e.reportStatus === '已出')
    if (!done.length) throw new Error('该患者暂无检查报告')
    return clone({
      exams: list,
      reports: done.map((e) => ({
        reportName: e.name, reportTime: e.reportTime, source: e.source,
        items: e.report.items, doctor: e.report.doctor, reviewer: e.report.reviewer
      }))
    })
  })
}
