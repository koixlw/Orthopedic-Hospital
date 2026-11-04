// 金额 / 时间 / 脱敏格式化：全站唯一出口
export const fmtAmount = (n) =>
  Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtMoney = (n) => '¥' + fmtAmount(n)

const p2 = (n) => String(n).padStart(2, '0')

export function fmtTime(d) {
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())} ${p2(x.getHours())}:${p2(x.getMinutes())}:${p2(x.getSeconds())}`
}

export function fmtMinute(d) {
  const x = d instanceof Date ? d : new Date(d)
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())} ${p2(x.getHours())}:${p2(x.getMinutes())}`
}

export function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return '—'
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`
}

export const fmtClock = (d) => {
  const x = d instanceof Date ? d : new Date(d)
  return `${p2(x.getHours())}:${p2(x.getMinutes())}:${p2(x.getSeconds())}`
}

export const maskIdCard = (s) => (!s ? '—' : s.slice(0, 8) + '****' + s.slice(-4))
export const maskPhone = (s) => (!s ? '—' : s.slice(0, 3) + '****' + s.slice(-4))

export const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function fmtDateCn(d) {
  const x = d instanceof Date ? d : new Date(d)
  return `${p2(x.getMonth() + 1)}-${p2(x.getDate())}（${WEEK[x.getDay()]}）`
}

export const round2 = (n) => Math.round(Number(n || 0) * 100) / 100
