// 操作日志（OBJ-SYS-001，5.12.3 / RULE-COM-003）
// 唯一写入口 log()；只追加，不提供 update / remove / clear
import { computed } from 'vue'
import { state, persist, LOG_MAX } from './state'
import { makeEntry } from '@/utils/audit'

/**
 * 写一条九要素操作日志
 * 失败动作也必须留痕：调用方传 result: 'FAIL' + failReason
 */
export function log(payload = {}) {
  const box = state.logs
  if (box.list.length >= LOG_MAX) {
    if (!box.overflow) {
      box.overflow = true
      console.warn('[logs] 演示环境日志已达上限（' + LOG_MAX + ' 条），停止写入，请重置演示数据')
      persist()
    }
    return null
  }
  box.seq = (box.seq || 0) + 1
  const entry = makeEntry({
    seq: box.seq,
    session: state.session,
    result: 'SUCCESS',
    ...payload
  })
  box.list.push(entry)
  persist()
  return entry
}

function inRange(time, from, to) {
  if (!from && !to) return true
  const d = String(time).slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

/** 列表页查询：倒序（最新在前），所有条件可选 */
export function query({ module, action, operator, dateFrom, dateTo, keyword, patientId, result } = {}) {
  return state.logs.list
    .filter((e) => !module || e.module === module)
    .filter((e) => !action || e.action === action)
    .filter((e) => !operator || e.operator === operator)
    .filter((e) => !patientId || e.patientId === patientId)
    .filter((e) => !result || e.result === result)
    .filter((e) => {
      if (!keyword) return true
      const kw = String(keyword).trim()
      return String(e.targetName || '').includes(kw) ||
        String(e.targetId || '').includes(kw) ||
        String(e.operator || '').includes(kw) ||
        String(e.page || '').includes(kw)
    })
    .filter((e) => inRange(e.time, dateFrom, dateTo))
    .slice()
    .sort((a, b) => b.seq - a.seq)
}

/** 按患者维度取数，正序（患者轨迹页用） */
export function queryByPatient(patientId) {
  return state.logs.list
    .filter((e) => e.patientId === patientId)
    .slice()
    .sort((a, b) => a.seq - b.seq)
}

export const overflow = computed(() => state.logs.overflow)
export const total = computed(() => state.logs.list.length)
