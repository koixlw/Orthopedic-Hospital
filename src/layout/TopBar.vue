<template>
  <header class="topbar">
    <div>
      <div class="page-title">{{ title }}</div>
      <div class="crumb">日间手术中心 / {{ title }}</div>
    </div>
    <div class="spacer"></div>

    <div class="dept">
      <el-icon><OfficeBuilding /></el-icon>
      日间手术中心
    </div>

    <el-dropdown trigger="click" @command="onRole">
      <div class="user-trigger">
        <el-avatar :size="24" style="background:#2b6cb0;font-size:12px">{{ state.session.name.slice(0, 1) }}</el-avatar>
        <div>
          <div class="who">{{ state.session.name }} <span class="role">· {{ state.session.roleLabel }}</span></div>
        </div>
        <el-icon :size="12" color="#8a94a6"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="r in ROLES" :key="r.key" :command="r.key">
            <span class="flex gap8" style="min-width:150px">
              <el-icon v-if="state.session.role === r.key" color="#2b6cb0"><Check /></el-icon>
              <span v-else style="width:14px"></span>
              <span>{{ r.label }}</span>
            </span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <div class="clock">{{ clock }}</div>
    <div class="demo-pill">演示环境</div>
  </header>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { state } from '@/store/db'
import { ROLES, switchRole } from '@/store/session'
import { fmtTime } from '@/utils/format'

const route = useRoute()
const title = computed(() => route.meta?.title || '工作台')
const clock = ref(fmtTime(new Date()))
let timer = null

onMounted(() => {
  timer = setInterval(() => { clock.value = fmtTime(new Date()) }, 1000)
})
onUnmounted(() => clearInterval(timer))

function onRole(key) {
  if (key === state.session.role) return
  switchRole(key)
  ElMessage.success(`已切换为 ${state.session.roleLabel} · ${state.session.name}`)
}
</script>
