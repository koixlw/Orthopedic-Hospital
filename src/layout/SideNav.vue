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

    <div class="side-foot" @click="onReset">
      <el-icon><RefreshLeft /></el-icon>
      <span>演示数据 · 重置</span>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { state, resetAll } from '@/store/db'
import { pendingSpecialist, pendingAnesthesia } from '@/store/evals'
import { NAV_GROUPS } from './nav'

const route = useRoute()

const groups = NAV_GROUPS

const counts = computed(() => ({
  apply: state.applies.filter((a) => a.status === 'PENDING').length,
  eval: pendingSpecialist().length + pendingAnesthesia().length,
  checkin: state.patients.filter((p) => p.status === 'ADMITTED').length
}))

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
