// 页面统一从 '@/store/db' 取 state / persist / resetAll（5.8）
// 真正的实现放在 state.js，这里只做单一出口，避免出现两个状态源
export {
  state, persist, hydrate, resetAll, seedAll, mustPatient,
  STORAGE_KEY, LOG_MAX, DEFAULT_SESSION
} from './state'

import { state } from './state'

/** 当前操作人上下文（顶栏 / 日志 / 各页面统一从这里取，禁止硬编码姓名） */
export const session = state.session
