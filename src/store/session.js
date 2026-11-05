// 当前登录人与角色上下文（4.1 角色清单 / 4.3 登录）
// 姓名、工号、岗位只在这里定义，业务代码一律取 session，禁止硬编码
import { state, persist } from './db'
import { roleAllows } from '@/utils/guard'
import { log } from './logs'
import { fmtTime } from '@/utils/format'

export const ROLES = [
  {
    key: 'NURSE', name: '陈静', roleLabel: '护士', title: '日间手术中心护士',
    account: 'N1024', duty: '入院登记、储值金冻结与转入、退出结算'
  },
  {
    key: 'CASHIER', name: '王芳', roleLabel: '收费员', title: '收费员',
    account: 'C2087', duty: '储值金缴存、冻结、门诊结算'
  },
  {
    key: 'DOCTOR', name: '张海涛', roleLabel: '医生', title: '医生（含主刀与麻醉）',
    account: 'D3312', duty: '转普通住院、手术费用、手术医嘱'
  },
  {
    key: 'ADMIN', name: '李伟', roleLabel: '系统管理员', title: '系统管理员（演示默认）',
    account: 'A0001', duty: '字典维护、日志与轨迹查看、演示数据重置'
  }
]

/** 演示默认角色：管理员全权限，保证主演示不被权限卡住（4.1） */
export const DEFAULT_ROLE = 'ADMIN'

export const currentRole = () => state.session.role
export const currentName = () => state.session.name
export const currentRoleLabel = () => state.session.roleLabel
export const isLoggedIn = () => !!state.session.loggedIn

/** 按钮可见性：无权限一律隐藏，不置灰（4.2 约定 1） */
export function can(code) {
  return roleAllows(state.session.role, code)
}

export function roleOf(key) {
  return ROLES.find((r) => r.key === key) || ROLES.find((r) => r.key === DEFAULT_ROLE)
}

/** 登录：写一条 LOGIN 日志，session 持久化，刷新后仍在登录态 */
export function login(key, reason = '演示环境登录') {
  const r = roleOf(key)
  state.session = {
    role: r.key,
    name: r.name,
    roleLabel: r.roleLabel,
    account: r.account,
    loggedIn: true,
    loginAt: fmtTime(new Date())
  }
  log({
    module: 'SYS', page: '登录页', action: 'LOGIN',
    targetType: '操作人', targetId: r.key,
    targetName: `${r.name}（${r.roleLabel}）`,
    patientId: null,
    after: { 登录人: `${r.name} / ${r.account}`, 岗位: r.title },
    reason
  })
  persist()
  return state.session
}

/** 退出登录：清空当前身份，回到登录页（不删任何业务数据与日志） */
export function logout() {
  const { name, roleLabel } = state.session
  log({
    module: 'SYS', page: '顶栏', action: 'LOGOUT',
    targetType: '操作人', targetId: state.session.role,
    targetName: `${name}（${roleLabel}）`,
    patientId: null,
    reason: '退出登录'
  })
  state.session = {
    role: '', name: '', roleLabel: '', account: '', loggedIn: false, loginAt: ''
  }
  persist()
}

/** 兼容旧调用：等同以目标角色重新登录 */
export function switchRole(key) {
  return login(key, '演示环境切换操作角色')
}
