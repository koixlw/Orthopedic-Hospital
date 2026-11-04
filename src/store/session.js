// 当前操作人与角色上下文（4.3 最小角色切换）
// 姓名映射只在这里定义，业务代码一律取 session，禁止硬编码
import { state, persist } from './db'
import { roleAllows } from '@/utils/guard'
import { log } from './logs'

export const ROLES = [
  { key: 'NURSE', name: '陈静', roleLabel: '护士', label: '日间手术中心护士' },
  { key: 'DOCTOR', name: '张海涛', roleLabel: '医生', label: '外科医生' },
  { key: 'CASHIER', name: '王芳', roleLabel: '收费员', label: '收费员' },
  { key: 'ADMIN', name: '李伟', roleLabel: '系统管理员', label: '系统管理员（演示）' }
]

export const currentRole = () => state.session.role
export const currentName = () => state.session.name
export const currentRoleLabel = () => state.session.roleLabel

/** 按钮可见性：无权限一律隐藏，不置灰（4.2 约定 1） */
export function can(code) {
  return roleAllows(state.session.role, code)
}

export function roleOf(key) {
  return ROLES.find((r) => r.key === key) || ROLES[0]
}

/** 切换角色：改上下文 + 写一条 LOGIN 日志（演示用，不代表真实鉴权） */
export function switchRole(key) {
  const r = roleOf(key)
  const from = state.session.roleLabel
  const fromName = state.session.name
  state.session = { role: r.key, name: r.name, roleLabel: r.roleLabel }
  log({
    module: 'SYS', page: '顶栏', action: 'LOGIN',
    targetType: '操作人', targetId: r.key, targetName: r.name + '（' + r.roleLabel + '）',
    patientId: null,
    before: { 操作人: fromName + '（' + from + '）' },
    after: { 操作人: r.name + '（' + r.roleLabel + '）' },
    reason: '演示环境切换操作角色'
  })
  persist()
  return { from, to: r.roleLabel, name: r.name, role: r.key }
}
