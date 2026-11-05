import { createRouter, createWebHashHistory } from 'vue-router'
import { HOSPITAL } from '@/layout/nav'

const routes = [
  { path: '/', redirect: '/workbench' },
  { path: '/workbench', name: 'workbench', component: () => import('@/views/Workbench.vue'), meta: { title: '工作台' } },
  { path: '/apply', name: 'apply', component: () => import('@/views/ApplyList.vue'), meta: { title: '手术申请' } },
  { path: '/evaluation/:patientId?', name: 'evaluation', component: () => import('@/views/PreOpEvaluation.vue'), meta: { title: '术前评估' } },
  { path: '/schedule', name: 'schedule', component: () => import('@/views/SurgerySchedule.vue'), meta: { title: '手术排程' } },
  { path: '/deposit/:patientId?', name: 'deposit', component: () => import('@/views/DepositAccount.vue'), meta: { title: '储值金管理' } },
  { path: '/admission/:patientId?', name: 'admission', component: () => import('@/views/Admission.vue'), meta: { title: '入院登记' } },
  { path: '/checkin', name: 'checkin', component: () => import('@/views/CheckIn.vue'), meta: { title: '手术报到' } },
  { path: '/charge/:patientId?', name: 'charge', component: () => import('@/views/SurgeryCharge.vue'), meta: { title: '手术费用' } },
  { path: '/order/:patientId?', name: 'order', component: () => import('@/views/SurgeryOrder.vue'), meta: { title: '手术医嘱' } },
  { path: '/transfer/:patientId?', name: 'transfer', component: () => import('@/views/TransferInpatient.vue'), meta: { title: '转普通入院' } },
  { path: '/dict-item', name: 'dictItem', component: () => import('@/views/DictItem.vue'), meta: { title: '收费项目与药品' } },
  { path: '/dict-group', name: 'dictGroup', component: () => import('@/views/DictGroup.vue'), meta: { title: '费用常用组套' } },
  { path: '/msg', name: 'msg', component: () => import('@/views/MsgCenter.vue'), meta: { title: '消息通知' } },
  { path: '/log', name: 'log', component: () => import('@/views/OpLog.vue'), meta: { title: '操作日志' } },
  { path: '/trace/:patientId?', name: 'trace', component: () => import('@/views/PatientTrace.vue'), meta: { title: '患者轨迹' } },
  { path: '/param', name: 'param', component: () => import('@/views/SysParam.vue'), meta: { title: '系统参数' } },
  { path: '/:pathMatch(.*)*', redirect: '/workbench' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · ${HOSPITAL.name}` : HOSPITAL.name
})

export default router
