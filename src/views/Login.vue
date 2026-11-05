<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 左：品牌与系统说明 -->
      <aside class="login-brand">
        <div class="lb-mark"></div>
        <div class="lb-name">{{ HOSPITAL.name }}</div>
        <div class="lb-system">
          <b>{{ HOSPITAL.systemMain }}</b>
          <span>{{ HOSPITAL.systemTail }}</span>
        </div>

        <div class="lb-line"></div>

        <ul class="lb-flow">
          <li><i>1</i>门急诊开立申请 · 抗凝停药校验</li>
          <li><i>2</i>术前检查检验 · 专科与麻醉评估</li>
          <li><i>3</i>储值金冻结 · 手术排程与通知</li>
          <li><i>4</i>入院登记 · 手术报到 · 费用医嘱</li>
        </ul>

        <div class="lb-foot">
          <span class="dot"></span>演示环境 · 数据为本地模拟，仅用于功能演示
        </div>
      </aside>

      <!-- 右：登录表单 -->
      <section class="login-form">
        <div class="lf-head">
          <h1>登录</h1>
          <p>不同岗位登录后可见的功能不同，请选择本次演示的岗位</p>
        </div>

        <div class="role-list">
          <div
            v-for="r in ROLES"
            :key="r.key"
            class="role-card"
            :class="{ on: selected === r.key }"
            @click="selected = r.key"
          >
            <div class="rc-radio"><span></span></div>
            <div class="rc-body">
              <div class="rc-top">
                <b>{{ r.name }}</b>
                <span class="rc-title">{{ r.title }}</span>
                <span class="rc-acc mono">{{ r.account }}</span>
              </div>
              <div class="rc-duty">{{ r.duty }}</div>
            </div>
          </div>
        </div>

        <div class="lf-row">
          <label>工号</label>
          <el-input :model-value="roleOf(selected).account" readonly />
          <label>密码</label>
          <el-input v-model="password" type="password" show-password placeholder="演示环境密码任意" />
        </div>

        <div v-if="already" class="lf-tip">
          当前已登录：<b>{{ state.session.name }}</b>（{{ state.session.roleLabel }}），继续登录将切换账号
        </div>

        <el-button type="primary" size="large" class="lf-btn" :loading="loading" @click="doLogin">
          登 录
        </el-button>

        <div class="lf-note">
          演示说明：管理员岗位拥有全部操作权限，便于完整走通流程；正式系统按岗位分离。
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { state } from '@/store/db'
import { ROLES, DEFAULT_ROLE, roleOf, login } from '@/store/session'
import { HOSPITAL } from '@/layout/nav'

const router = useRouter()
const route = useRoute()

const selected = ref(DEFAULT_ROLE)
const password = ref('123456')
const loading = ref(false)
const already = computed(() => !!state.session.loggedIn)

function doLogin() {
  if (!selected.value) {
    ElMessage.warning('请选择登录岗位')
    return
  }
  loading.value = true
  setTimeout(() => {
    const s = login(selected.value)
    loading.value = false
    ElMessage.success(`已登录：${s.name} · ${s.roleLabel}`)
    router.replace(route.query.redirect || '/workbench')
  }, 420)
}
</script>

<style scoped>
.login-page {
  height: 100vh; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(1200px 600px at 15% 0%, #e8f1fa 0%, #f5f8fc 45%, #eef2f8 100%);
}
.login-card {
  display: flex; width: 940px; height: 560px; background: #fff; border-radius: 12px;
  overflow: hidden; box-shadow: 0 18px 50px rgba(25, 54, 92, .16), 0 2px 6px rgba(25, 54, 92, .06);
}

/* 左栏 */
.login-brand {
  width: 360px; flex: 0 0 360px; padding: 40px 34px 26px; color: #fff;
  background: linear-gradient(160deg, #1f4e79 0%, #2b6cb0 62%, #2f7bbd 100%);
  display: flex; flex-direction: column; position: relative; overflow: hidden;
}
.login-brand::after {
  content: ''; position: absolute; right: -70px; bottom: -90px; width: 260px; height: 260px;
  border-radius: 50%; background: rgba(255, 255, 255, .06);
}
.lb-mark {
  width: 42px; height: 42px; border-radius: 9px; background: rgba(255, 255, 255, .16);
  position: relative; margin-bottom: 18px;
}
.lb-mark::before, .lb-mark::after { content: ''; position: absolute; background: #fff; border-radius: 1px; }
.lb-mark::before { left: 50%; top: 10px; bottom: 10px; width: 5px; margin-left: -2.5px; }
.lb-mark::after { top: 50%; left: 10px; right: 10px; height: 5px; margin-top: -2.5px; }
.lb-name { font-size: 21px; font-weight: 700; letter-spacing: 2px; }
.lb-system { margin-top: 7px; font-size: 12.5px; }
.lb-system b { font-weight: 600; color: #fff; }
.lb-system span { color: rgba(255, 255, 255, .66); margin-left: 6px; }
.lb-line { height: 1px; background: rgba(255, 255, 255, .2); margin: 26px 0 20px; }
.lb-flow { list-style: none; padding: 0; margin: 0; }
.lb-flow li {
  display: flex; align-items: center; gap: 9px; font-size: 12.5px;
  color: rgba(255, 255, 255, .82); margin-bottom: 14px; line-height: 1.5;
}
.lb-flow i {
  width: 18px; height: 18px; flex: none; border-radius: 50%; background: rgba(255, 255, 255, .18);
  font-style: normal; font-size: 11px; display: flex; align-items: center; justify-content: center;
}
.lb-foot {
  margin-top: auto; font-size: 11px; color: rgba(255, 255, 255, .62);
  display: flex; align-items: center; gap: 6px; line-height: 1.6;
}
.lb-foot .dot { width: 6px; height: 6px; border-radius: 50%; background: #7fe3b0; flex: none; }

/* 右栏 */
.login-form { flex: 1; padding: 34px 38px 24px; display: flex; flex-direction: column; }
.lf-head h1 { margin: 0; font-size: 22px; font-weight: 700; color: #16233a; letter-spacing: 1px; }
.lf-head p { margin: 7px 0 0; font-size: 12px; color: #8a94a6; }

.role-list { margin: 20px 0 18px; display: flex; flex-direction: column; gap: 8px; }
.role-card {
  display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 8px;
  border: 1px solid #e5e9f0; cursor: pointer; transition: border-color .15s, background .15s;
}
.role-card:hover { border-color: #c3d6e8; background: #fafcfe; }
.role-card.on { border-color: #2b6cb0; background: #f2f7fd; box-shadow: 0 0 0 1px #2b6cb0 inset; }
.rc-radio {
  width: 15px; height: 15px; border-radius: 50%; border: 1px solid #c3ccd9; flex: none;
  display: flex; align-items: center; justify-content: center; background: #fff;
}
.role-card.on .rc-radio { border-color: #2b6cb0; }
.role-card.on .rc-radio span { width: 7px; height: 7px; border-radius: 50%; background: #2b6cb0; }
.rc-body { min-width: 0; flex: 1; }
.rc-top { display: flex; align-items: center; gap: 8px; }
.rc-top b { font-size: 13.5px; color: #1f2937; }
.rc-title { font-size: 12px; color: #4b5563; }
.rc-acc { font-size: 11px; color: #98a5b6; margin-left: auto; }
.rc-duty { font-size: 11px; color: #8a94a6; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.lf-row {
  display: grid; grid-template-columns: 40px 1fr; align-items: center;
  row-gap: 10px; column-gap: 10px; margin-bottom: 12px;
}
.lf-row label { font-size: 12.5px; color: #5b6678; text-align: right; }
.lf-tip {
  font-size: 11.5px; color: #8a5a1f; background: #fdf6ec; border: 1px solid #f5e2c6;
  border-radius: 6px; padding: 7px 10px; margin-bottom: 10px; line-height: 1.6;
}
.lf-btn { width: 100%; letter-spacing: 4px; height: 40px; }
.lf-note { margin-top: 14px; font-size: 11px; color: #a3adbb; line-height: 1.7; }
</style>
