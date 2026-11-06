import { createRouter, createWebHashHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { HOSPITAL } from '@/layout/nav'
import { state } from '@/store/db'
import { roleAllows, PAGE_LABEL } from '@/utils/guard'
import AppLayout from '@/layout/AppLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: '/workbench' },
      { path: '/workbench', name: 'workbench', component: () => import('@/views/Workbench.vue'), meta: { title: '工作台', perm: 'workbench' } },
      { path: '/apply', name: 'apply', component: () => import('@/views/ApplyList.vue'), meta: { title: '手术申请', perm: 'apply' } },
      { path: '/evaluation', name: 'evaluation', component: () => import('@/views/EvalList.vue'), meta: { title: '术前评估', perm: 'evaluate' } },
      { path: '/evaluation/:patientId', name: 'evaluationDetail', component: () => import('@/views/PreOpEvaluation.vue'), meta: { title: '术前评估详情', perm: 'evaluate' } },
      { path: '/schedule', name: 'schedule', component: () => import('@/views/SurgerySchedule.vue'), meta: { title: '手术排程', perm: 'schedule' } },
      { path: '/deposit/:patientId?', name: 'deposit', component: () => import('@/views/DepositAccount.vue'), meta: { title: '储值金管理', perm: 'deposit' } },
      { path: '/admission/:patientId?', name: 'admission', component: () => import('@/views/Admission.vue'), meta: { title: '入院登记', perm: 'admission' } },
      { path: '/checkin', name: 'checkin', component: () => import('@/views/CheckIn.vue'), meta: { title: '手术报到', perm: 'checkin' } },
      { path: '/charge/:patientId?', name: 'charge', component: () => import('@/views/SurgeryCharge.vue'), meta: { title: '手术费用', perm: 'charge' } },
      { path: '/order/:patientId?', name: 'order', component: () => import('@/views/SurgeryOrder.vue'), meta: { title: '手术医嘱', perm: 'order' } },
      { path: '/transfer', name: 'transfer', component: () => import('@/views/TransferList.vue'), meta: { title: '转普通入院', perm: 'transfer' } },
      { path: '/transfer/:patientId', name: 'transferDetail', component: () => import('@/views/TransferInpatient.vue'), meta: { title: '转普通入院操作', perm: 'transfer' } },
      { path: '/dict-item', name: 'dictItem', component: () => import('@/views/DictItem.vue'), meta: { title: '收费项目与药品', perm: 'dict' } },
      { path: '/dict-group', name: 'dictGroup', component: () => import('@/views/DictGroup.vue'), meta: { title: '费用常用组套', perm: 'dict' } },
      { path: '/msg', name: 'msg', component: () => import('@/views/MsgCenter.vue'), meta: { title: '消息通知', perm: 'message' } },
      { path: '/log', name: 'log', component: () => import('@/views/OpLog.vue'), meta: { title: '操作日志', perm: 'log' } },
      { path: '/trace/:patientId?', name: 'trace', component: () => import('@/views/PatientTrace.vue'), meta: { title: '患者轨迹', perm: 'trace' } },
      { path: '/param', name: 'param', component: () => import('@/views/SysParam.vue'), meta: { title: '系统参数', perm: 'setting' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/workbench' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

/**
 * 路由守卫：未登录去登录页；越权页面拦回工作台。
 * 界面隐藏 + 路由拦截 + store 二次校验，三层判断同一份权限码表。
 */
router.beforeEach((to) => {
  if (to.meta?.public) return true

  if (!state.session.loggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  const perm = to.meta?.perm
  if (perm && !roleAllows(state.session.role, perm)) {
    ElMessage.warning(`当前角色（${state.session.roleLabel}）无「${PAGE_LABEL[perm] || perm}」访问权限`)
    return { path: '/workbench' }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · ${HOSPITAL.name}` : HOSPITAL.name
})

export default router
