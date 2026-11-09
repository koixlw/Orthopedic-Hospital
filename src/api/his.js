// 外部系统唯一出口：页面与 store 只认这里（SIM-002 / SIM-003）
// 上线时把 USE_MOCK 改为 false 并补 http 实现，页面一行不改
import * as mock from '@/mock/his'

const USE_MOCK = true

const http = {
  get: (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('接口调用失败，请稍后重试'))))
}

export const isMockSource = () => USE_MOCK

export const fetchApplyPool = () =>
  USE_MOCK ? mock.fetchApplyPool() : http.get('/his/day-surgery/applies')

/** 待接收申请单数量（按钮角标提醒用，不返回明细） */
export const fetchApplyPoolCount = () =>
  USE_MOCK ? Promise.resolve(mock.fetchApplyPoolCount()) : http.get('/his/day-surgery/applies/count')

export const fetchPatientArchive = (inpatientNo) =>
  USE_MOCK ? mock.fetchPatientArchive(inpatientNo) : http.get(`/his/preop/archive?inpatientNo=${inpatientNo}`)

/** 刷卡读取患者（招标第 11 项：刷医保卡 / 就诊卡 / 身份证） */
export const fetchPatientByCard = (cardType, cardNo) =>
  USE_MOCK ? mock.fetchPatientByCard(cardType, cardNo)
    : http.get(`/his/preop/card?type=${cardType}&no=${encodeURIComponent(cardNo || '')}`)

export const fetchExamReports = (patientId) =>
  USE_MOCK ? mock.fetchExamReports(patientId) : http.get(`/his/preop/reports?patientId=${patientId}`)
