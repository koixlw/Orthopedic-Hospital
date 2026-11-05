<template>
  <header class="topbar">
    <!-- 左：院徽 + 院名 -->
    <div class="brand">
      <div class="brand-mark"></div>
      <div class="brand-text">
        <div class="name">{{ HOSPITAL.name }}</div>
        <div class="sub"><b>{{ HOSPITAL.systemMain }}</b><span>{{ HOSPITAL.systemTail }}</span></div>
      </div>
    </div>

    <!-- 中：一级业务模块 -->
    <nav class="top-nav">
      <router-link
        v-for="m in MODULES"
        :key="m.key"
        :to="m.to"
        class="top-tab"
        :class="{ on: m.key === activeModule }"
      >{{ m.label }}</router-link>
    </nav>

    <div class="spacer"></div>

    <!-- 右：业务日期 / 岗位 / 当前用户 -->
    <div class="top-date">业务日期 <b>{{ today }}</b></div>
    <div class="top-divider"></div>

    <div class="role-pill">
      <el-icon :size="12" color="#8a94a6"><OfficeBuilding /></el-icon>
      <span>日间手术中心 · {{ state.session.roleLabel }}</span>
    </div>

    <div class="top-divider"></div>

    <el-dropdown trigger="click" @command="onCommand">
      <div class="top-user">
        <el-avatar :size="26" style="background:#2b6cb0;font-size:12px">{{ state.session.name.slice(0, 1) }}</el-avatar>
        <span class="who">{{ state.session.name }}</span>
        <el-icon :size="12" color="#8a94a6"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <div class="who-card">
            <div class="wc-name">{{ state.session.name }} <span>日间手术中心 · {{ state.session.roleLabel }}</span></div>
            <div class="wc-meta">工号 {{ state.session.account }} · 日间手术中心</div>
          </div>
          <el-dropdown-item divided disabled>切换岗位（演示）</el-dropdown-item>
          <el-dropdown-item v-for="r in ROLES" :key="r.key" :command="'role:' + r.key">
            <span class="flex gap8" style="min-width:168px">
              <el-icon v-if="state.session.role === r.key" color="#2b6cb0"><Check /></el-icon>
              <span v-else style="width:14px"></span>
              <span>{{ r.title }}</span>
            </span>
          </el-dropdown-item>
          <el-dropdown-item divided command="logout">
            <span class="flex gap8" style="min-width:168px;color:#c53030">
              <el-icon><SwitchButton /></el-icon><span>退出登录</span>
            </span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <div class="demo-pill">演示环境</div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { state } from '@/store/db'
import { ROLES, logout, switchRole } from '@/store/session'
import { HOSPITAL, MODULES, moduleOf } from './nav'

const route = useRoute()
const router = useRouter()
const activeModule = computed(() => moduleOf(route.path))
const today = dayjs().format('YYYY-MM-DD')

function onCommand(cmd) {
  if (cmd === 'logout') return doLogout()
  if (String(cmd).startsWith('role:')) {
    const key = String(cmd).slice(5)
    if (key === state.session.role) return
    const s = switchRole(key)
    ElMessage.success(`已切换为 ${s.name} · ${s.roleLabel}，界面按新岗位刷新`)
    // 当前页若新岗位无权限，路由守卫会拦回工作台
    router.replace(route.fullPath)
  }
}

function doLogout() {
  ElMessageBox.confirm('退出后需重新登录，演示数据与操作日志不会丢失。', '退出登录', {
    type: 'warning', confirmButtonText: '退出', cancelButtonText: '取消'
  }).then(() => {
    logout()
    router.replace('/login')
  }).catch(() => {})
}
</script>
