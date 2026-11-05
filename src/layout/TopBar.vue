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

    <!-- 右：业务日期 / 岗位切换 / 当前用户 -->
    <div class="top-date">业务日期 <b>{{ today }}</b></div>
    <div class="top-divider"></div>

    <el-dropdown trigger="click" @command="onRole">
      <div class="role-pill">
        <span>日间手术中心 · {{ state.session.roleLabel }}</span>
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

    <div class="top-divider"></div>

    <div class="top-user">
      <el-avatar :size="26" style="background:#2b6cb0;font-size:12px">{{ state.session.name.slice(0, 1) }}</el-avatar>
      <span class="who">{{ state.session.name }}</span>
    </div>

    <div class="demo-pill">演示环境</div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { state } from '@/store/db'
import { ROLES, switchRole } from '@/store/session'
import { HOSPITAL, MODULES, moduleOf } from './nav'

const route = useRoute()
const activeModule = computed(() => moduleOf(route.path))
const today = dayjs().format('YYYY-MM-DD')

function onRole(key) {
  if (key === state.session.role) return
  switchRole(key)
  ElMessage.success(`已切换为 ${state.session.roleLabel} · ${state.session.name}`)
}
</script>
