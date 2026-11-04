<template>
  <aside class="side">
    <div class="side-brand">
      <div class="logo">
        <el-icon :size="16"><FirstAidKit /></el-icon>
      </div>
      <div>
        <div class="name">日间手术<br />预入院管理平台</div>
        <div class="sub">DAY SURGERY PRE-ADMISSION</div>
      </div>
    </div>

    <nav class="side-menu">
      <div class="menu-group-title">业务办理</div>
      <router-link
        v-for="m in business"
        :key="m.path"
        :to="m.path"
        class="nav-item"
        :class="{ active: isActive(m) }"
      >
        <el-icon><component :is="m.icon" /></el-icon>
        <span>{{ m.label }}</span>
        <span v-if="m.badge" class="nav-dot" :class="{ hot: m.hot }">{{ m.badge }}</span>
      </router-link>

      <div class="menu-group-title">基础数据</div>
      <router-link
        v-for="m in basics"
        :key="m.path"
        :to="m.path"
        class="nav-item"
        :class="{ active: isActive(m) }"
      >
        <el-icon><component :is="m.icon" /></el-icon>
        <span>{{ m.label }}</span>
      </router-link>
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
import { statCards } from '@/store/patients'
import { pendingSpecialist, pendingAnesthesia } from '@/store/evals'

const route = useRoute()

const stats = computed(() => statCards())
const evalCount = computed(() => pendingSpecialist().length + pendingAnesthesia().length)
const applyCount = computed(() => state.applies.filter((a) => a.status === 'PENDING').length)
const checkinCount = computed(() => state.patients.filter((p) => p.status === 'ADMITTED').length)

const business = computed(() => [
  { label: '工作台', path: '/workbench', icon: 'Odometer' },
  { label: '手术申请', path: '/apply', icon: 'DocumentAdd', badge: applyCount.value || '', hot: true },
  { label: '术前评估', path: '/evaluation', icon: 'FirstAidKit', badge: evalCount.value || '' },
  { label: '手术排程', path: '/schedule', icon: 'Calendar' },
  { label: '储值金管理', path: '/deposit', icon: 'Wallet' },
  { label: '入院登记', path: '/admission', icon: 'OfficeBuilding' },
  { label: '手术报到', path: '/checkin', icon: 'Postcard', badge: checkinCount.value || '' },
  { label: '手术费用', path: '/charge', icon: 'Tickets' },
  { label: '手术医嘱', path: '/order', icon: 'Memo' },
  { label: '转普通入院', path: '/transfer', icon: 'Right' }
])

const basics = [
  { label: '收费项目与药品', path: '/dict-item', icon: 'Files' },
  { label: '费用常用组套', path: '/dict-group', icon: 'Collection' },
  { label: '消息通知', path: '/msg', icon: 'ChatDotSquare' },
  { label: '操作日志', path: '/log', icon: 'Tickets' },
  { label: '患者轨迹', path: '/trace', icon: 'Position' },
  { label: '系统参数', path: '/param', icon: 'Setting' }
]

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
