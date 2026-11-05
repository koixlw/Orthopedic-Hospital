// OBJ-DIC-001 / 002 / 003 收费项目、药品、常用组套（3.11—3.13）
// 字典项只停用与软移除，不物理删除（RULE-COM-001）
import { computed } from 'vue'
import { assertCan } from '@/utils/guard'
import { state, persist } from './db'
import { log } from './logs'
import { round2 } from '@/utils/format'

export const items = computed(() => state.dicts.items)
export const drugs = computed(() => state.dicts.drugs)
export const groups = computed(() => state.dicts.groups)
export const evalReasons = computed(() => state.dicts.evalReasons)

const KIND_LABEL = { item: '收费项目', drug: '药品', group: '费用组套', reason: '评估原因' }

function bucket(kind) {
  if (kind === 'item') return state.dicts.items
  if (kind === 'drug') return state.dicts.drugs
  if (kind === 'group') return state.dicts.groups
  if (kind === 'reason') return state.dicts.evalReasons
  throw new Error('未知的字典类型')
}

function find(kind, code) {
  const list = bucket(kind)
  const key = kind === 'group' ? 'groupId' : 'code'
  return list.find((x) => x[key] === code) || null
}

/** 收费项目是否已被费用单或组套引用 */
export function itemReferenced(code) {
  const inCharges = state.charges.some((c) => c.lines.some((l) => l.code === code))
  const inGroups = state.dicts.groups.some((g) => g.lines.some((l) => l.code === code))
  return inCharges || inGroups
}

/** 药品是否已被医嘱引用 */
export function drugReferenced(code) {
  return state.orders.some((o) => o.drugCode === code)
}

export function addItem(payload) {
  assertCan('dict.edit', { module: 'DICT', page: '收费项目与药品', action: 'CREATE', label: '维护基础字典', targetType: '收费项目' })
  if (!payload.code || !payload.name) throw new Error('编码与名称为必填项')
  if (find('item', payload.code)) throw new Error('收费项目编码 ' + payload.code + ' 已存在')
  const item = {
    code: payload.code,
    name: payload.name,
    spec: payload.spec || '次',
    unit: payload.unit || '次',
    price: Number(payload.price || 0),
    category: payload.category || '手术费',
    enabled: true,
    removed: false
  }
  state.dicts.items.push(item)
  log({
    module: 'DICT', page: '收费项目字典', action: 'CREATE',
    targetType: '收费项目', targetId: item.code, targetName: item.name,
    patientId: null, before: null,
    after: { 编码: item.code, 名称: item.name, 单价: item.price, 类别: item.category },
    reason: '新增收费项目'
  })
  persist()
  return item
}

export function addDrug(payload) {
  assertCan('dict.edit', { module: 'DICT', page: '收费项目与药品', action: 'CREATE', label: '维护基础字典', targetType: '药品' })
  if (!payload.code || !payload.name) throw new Error('编码与名称为必填项')
  if (find('drug', payload.code)) throw new Error('药品编码 ' + payload.code + ' 已存在')
  const drug = {
    code: payload.code,
    name: payload.name,
    spec: payload.spec || '',
    dose: Number(payload.dose || 0),
    unit: payload.unit || 'mg',
    usage: payload.usage || '静注',
    isAnesthetic: !!payload.isAnesthetic,
    enabled: true,
    removed: false
  }
  state.dicts.drugs.push(drug)
  log({
    module: 'DICT', page: '药品字典', action: 'CREATE',
    targetType: '药品', targetId: drug.code, targetName: drug.name,
    patientId: null, before: null,
    after: {
      编码: drug.code, 名称: drug.name, 规格: drug.spec,
      麻醉药: drug.isAnesthetic ? '是' : '否'
    },
    reason: '新增药品'
  })
  persist()
  return drug
}

/** 修改字典项（项目 / 药品通用） */
export function patchDict(kind, code, patch, reason = '') {
  assertCan('dict.edit', { module: 'DICT', page: '收费项目与药品', action: 'UPDATE', label: '维护基础字典', targetType: '字典项' })
  const row = find(kind, code)
  if (!row) throw new Error('未找到该' + (KIND_LABEL[kind] || '字典项'))
  const before = {}
  Object.keys(patch).forEach((k) => { before[k] = row[k] })
  Object.keys(patch).forEach((k) => {
    if (k === 'code') return
    if (k === 'price' || k === 'dose') row[k] = Number(patch[k] || 0)
    else row[k] = patch[k]
  })
  log({
    module: 'DICT', page: (KIND_LABEL[kind] || '字典') + '字典', action: 'UPDATE',
    targetType: KIND_LABEL[kind] || '字典项', targetId: row.code || row.groupId || '',
    targetName: row.name, patientId: null, before, after: { ...patch },
    reason: reason || '修改字典项'
  })
  persist()
  return row
}

/** 启用 / 停用（不删记录，历史单据仍显示名称） */
export function toggle(kind, code) {
  assertCan('dict.toggle', { module: 'DICT', page: '收费项目与药品', action: 'DISABLE', label: '启停用字典项', targetType: '字典项' })
  const row = find(kind, code)
  if (!row) throw new Error('未找到该' + (KIND_LABEL[kind] || '字典项'))
  const before = { 状态: row.enabled ? '启用' : '停用' }
  row.enabled = !row.enabled
  log({
    module: 'DICT', page: (KIND_LABEL[kind] || '字典') + '字典',
    action: row.enabled ? 'ENABLE' : 'DISABLE',
    targetType: KIND_LABEL[kind] || '字典项', targetId: row.code || row.groupId || '',
    targetName: row.name, patientId: null, before,
    after: { 状态: row.enabled ? '启用' : '停用' },
    reason: row.enabled ? '启用字典项' : '停用字典项'
  })
  persist()
  return row
}

/** 软移除：仅允许移除未被引用的字典项 */
export function removeItem(kind, code, reason = '') {
  assertCan('dict.remove', { module: 'DICT', page: '收费项目与药品', action: 'REMOVE', label: '移除字典项', targetType: '字典项' })
  const row = find(kind, code)
  if (!row) throw new Error('未找到该' + (KIND_LABEL[kind] || '字典项'))
  if (row.removed) throw new Error('该字典项已移除，不能重复移除')
  if (kind === 'item' && itemReferenced(code)) throw new Error('该收费项目已被费用单或组套引用，只能停用，不能移除')
  if (kind === 'drug' && drugReferenced(code)) throw new Error('该药品已被医嘱引用，只能停用，不能移除')
  const before = { 状态: row.enabled ? '启用' : '停用' }
  row.removed = true
  row.enabled = false
  log({
    module: 'DICT', page: (KIND_LABEL[kind] || '字典') + '字典', action: 'REMOVE',
    targetType: KIND_LABEL[kind] || '字典项', targetId: row.code || row.groupId || '',
    targetName: row.name, patientId: null, before,
    after: { 状态: '已移除（软删，记录保留）' },
    reason
  })
  persist()
  return row
}

/* ---------------- 常用组套 ---------------- */
export function saveGroup(groupId, payload) {
  assertCan('dict.edit', { module: 'DICT', page: '收费项目与药品', action: 'UPDATE', label: '维护费用组套', targetType: '费用组套' })
  const g = state.dicts.groups.find((x) => x.groupId === groupId)
  if (!g) throw new Error('未找到该费用组套')
  if (!payload.name) throw new Error('请填写组套名称')
  if (!payload.lines || !payload.lines.length) throw new Error('组套至少需要一条明细')
  if (payload.lines.some((l) => !l.name || !(Number(l.qty) > 0))) {
    throw new Error('组套明细的项目名称与数量必须完整')
  }
  const before = { 组套名称: g.name, 明细条数: g.lines.length, 合计: g.total }
  g.name = payload.name
  g.lines = payload.lines.map((l) => ({
    code: l.code || '',
    name: l.name,
    spec: l.spec || '',
    unit: l.unit || '',
    qty: Number(l.qty || 1),
    price: Number(l.price || 0)
  }))
  g.total = round2(g.lines.reduce((s, l) => s + l.qty * l.price, 0))
  log({
    module: 'DICT', page: '组套字典', action: 'UPDATE',
    targetType: '费用组套', targetId: g.groupId, targetName: g.name,
    patientId: null, before,
    after: { 组套名称: g.name, 明细条数: g.lines.length, 合计: g.total },
    reason: '保存常用组套'
  })
  persist()
  return g
}
