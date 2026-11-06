// HIS 待接收申请单数量（SIM-002：外部系统只经 api/his.js 读取，页面与 store 都不直接碰 mock）
// 侧栏「日间手术申请」角标与页面「接收 HIS 申请单」按钮角标共用这一份数据，保证两处数字一致
import { ref } from 'vue'
import { fetchApplyPoolCount } from '@/api/his'

/** HIS 诊间待接收申请单数 */
export const poolCount = ref(0)
/** 数量是否已取到：取到且为 0 → 没有新的申请单 */
export const poolCountLoaded = ref(false)

/** 拉取 HIS 待接收申请单数量；取不到时保留上一次的值 */
export async function refreshPoolCount() {
  try {
    const res = await fetchApplyPoolCount()
    poolCount.value = Number(res.count || 0)
    poolCountLoaded.value = true
  } catch (e) {
    poolCountLoaded.value = false
  }
  return poolCount.value
}
