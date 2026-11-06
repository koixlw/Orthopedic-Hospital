/**
 * 品牌与导航的单一数据源。
 * 需要换医院名称时只改 HOSPITAL.name；菜单分组只改 NAV_GROUPS，侧栏与顶栏会自动同步。
 */

export const HOSPITAL = {
  name: '四川省骨科医院',
  system: '预入出院（日间手术）管理系统',
  // 顶栏副标题分两段排版：前段加粗、后段淡色
  systemMain: '预入出院（日间手术）',
  systemTail: '管理系统',
  short: '日间手术预入院'
}

/** 顶栏一级模块：作为粗粒度入口，点击进入该模块首个页面 */
export const MODULES = [
  { key: 'clinic', label: '门诊业务', to: '/apply' },
  { key: 'ward', label: '住院业务', to: '/admission' },
  { key: 'surgery', label: '手术业务', to: '/schedule' },
  { key: 'report', label: '统计报表', to: '/trace' },
  { key: 'system', label: '系统管理', to: '/param' }
]

/**
 * 侧栏分组：按「患者所处的业务阶段」组织，与顶栏模块一一对应（overview 不参与模块高亮）。
 * badge 为角标取值键，由 SideNav 计算，不在这里写死数字。
 */
export const NAV_GROUPS = [
  {
    // 总览归属门诊业务（工作台是门诊侧的入口），保证任何页面都有一级模块高亮
    key: 'overview', title: '总览', module: 'clinic',
    items: [{ label: '工作台', path: '/workbench', perm: 'workbench', icon: 'Odometer' }]
  },
  {
    key: 'clinic', title: '门诊申请阶段', module: 'clinic',
    items: [
      { label: '日间手术申请', path: '/apply', perm: 'apply', icon: 'DocumentAdd', badge: 'apply', hot: true },
      { label: '术前评估', path: '/evaluation', perm: 'evaluate', icon: 'FirstAidKit' }
    ]
  },
  {
    key: 'ward', title: '住院环节', module: 'ward',
    items: [
      { label: '储值金管理', path: '/deposit', perm: 'deposit', icon: 'Wallet' },
      { label: '入院登记', path: '/admission', perm: 'admission', icon: 'OfficeBuilding' },
      { label: '手术报到', path: '/checkin', perm: 'checkin', icon: 'Postcard' },
      { label: '转普通入院', path: '/transfer', perm: 'transfer', icon: 'Right' }
    ]
  },
  {
    key: 'surgery', title: '手术环节', module: 'surgery',
    items: [
      { label: '手术排程', path: '/schedule', perm: 'schedule', icon: 'Calendar' },
      { label: '手术费用', path: '/charge', perm: 'charge', icon: 'Tickets' },
      { label: '手术医嘱', path: '/order', perm: 'order', icon: 'Memo' }
    ]
  },
  {
    key: 'report', title: '管理与统计', module: 'report',
    items: [
      { label: '患者轨迹', path: '/trace', perm: 'trace', icon: 'Position' },
      { label: '操作日志', path: '/log', perm: 'log', icon: 'List' },
      { label: '消息通知', path: '/msg', perm: 'message', icon: 'ChatDotSquare' }
    ]
  },
  {
    key: 'system', title: '系统设置', module: 'system',
    items: [
      { label: '收费项目与药品', path: '/dict-item', perm: 'dict', icon: 'Files' },
      { label: '费用常用组套', path: '/dict-group', perm: 'dict', icon: 'Collection' },
      { label: '系统参数', path: '/param', perm: 'setting', icon: 'Setting' }
    ]
  }
]

/** 当前路由归属的模块 key，用于顶栏高亮 */
export function moduleOf(path) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (path === it.path || path.startsWith(it.path + '/')) return g.module
    }
  }
  return ''
}

/** 当前路由的菜单项，用于顶栏面包屑 */
export function itemOf(path) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (path === it.path || path.startsWith(it.path + '/')) return { ...it, group: g.title }
    }
  }
  return null
}
