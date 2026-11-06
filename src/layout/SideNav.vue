<template>
  <aside class="side">
    <nav class="side-menu">
      <template v-for="g in groups" :key="g.key">
        <div class="menu-group-title">{{ g.title }}</div>
        <router-link
          v-for="m in g.items"
          :key="m.path"
          :to="m.path"
          class="nav-item"
          :class="{ active: isActive(m) }"
        >
          <el-icon><component :is="m.icon" /></el-icon>
          <span class="nav-label">{{ m.label }}</span>
          <span v-if="badgeOf(m)" class="nav-dot" :class="{ hot: m.hot }">{{ badgeOf(m) }}</span>
        </router-link>
      </template>
    </nav>

    <div v-if="can('sys.reset')" class="side-foot" @click="onReset">
      <el-icon><RefreshLeft /></el-icon>
      <span>演示数据 · 重置</span>
    </div>
    <div v-else class="side-role">
      <el-icon><Lock /></el-icon>
      <span>当前岗位仅显示有权限的菜单</span>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { resetAll } from '@/store/db'
import { can } from '@/store/session'
import { poolCount, refreshPoolCount } from '@/store/his'
import { NAV_GROUPS } from './nav'

const route = useRoute()

/** 按当前角色裁剪菜单：无权限的菜单不显示，整组为空时连分组标题一起隐藏 */
const groups = computed(() => NAV_GROUPS
  .map((g) => ({ ...g, items: g.items.filter((it) => can(it.perm)) }))
  .filter((g) => g.items.length))

// 侧栏只有「日间手术申请」带角标：HIS 待接收申请单数（与页面「接收 HIS 申请单」按钮角标同源）
const counts = computed(() => ({
  apply: can('apply.receive') ? poolCount.value : ''
}))

// 进页面就取一次 HIS 待接收数量；接收申请单后由申请页刷新，两处角标同步变化
onMounted(refreshPoolCount)

function badgeOf(m) {
  if (!m.badge) return ''
  return counts.value[m.badge] || ''
}

function isActive(m) {
  return route.path === m.path || route.path.startsWith(m.path + '/')
}

function onReset() {
  ElMessageBox.confirm(
    '确认重置演示数据？本次演示产生的全部操作记录与业务数据将被清空，用于重新开始演示。',
    '重置演示数据',
    { type: 'warning', confirmButtonText: '确认重置', cancelButtonText: '取消' }
  ).then(() => {
    ElMessage.success('演示数据已重置')
    setTimeout(() => resetAll(), 200)
  }).catch(() => {})
}
</script>
