<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">基础数据维护</div>
        <div class="card-sub">收费项目与药品字典：停用项历史可见，新建不可选</div>
        <div class="right">
          <el-button v-if="can('dict.edit')" type="primary" :icon="Plus" @click="openAdd">新增{{ tab === 'item' ? '收费项目' : '药品' }}</el-button>
        </div>
      </div>

      <el-tabs v-model="tab" @tab-change="resetFilter">
        <el-tab-pane label="收费项目" name="item" />
        <el-tab-pane label="药品字典" name="drug" />
      </el-tabs>

      <div class="toolbar">
        <el-input v-model="kw" placeholder="编码 / 名称" clearable :prefix-icon="Search" style="width:200px" />
        <el-select v-model="category" clearable placeholder="类别" style="width:140px">
          <el-option v-for="c in (tab === 'item' ? CHARGE_CATEGORIES : ['麻醉药', '非麻醉药'])" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="status" clearable placeholder="状态" style="width:120px">
          <el-option label="启用" value="1" />
          <el-option label="停用" value="0" />
        </el-select>
        <span class="muted" style="margin-left:auto">共 {{ rows.length }} 条</span>
      </div>

      <el-table v-if="tab === 'item'" :data="rows" size="small" border style="width:100%">
        <el-table-column prop="code" label="编码" width="86">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="168" />
        <el-table-column prop="spec" label="规格" width="108" />
        <el-table-column prop="unit" label="单位" width="62" align="center" />
        <el-table-column label="单价" width="98" align="right">
          <template #default="{ row }"><span class="num">¥{{ fmtAmount(row.price) }}</span></template>
        </el-table-column>
        <el-table-column label="类别" width="90" align="center">
          <template #default="{ row }"><el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag></template>
        </el-table-column>
        <el-table-column label="状态" width="82" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button v-if="can('dict.edit')" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="can('dict.toggle')" link :type="row.enabled ? 'warning' : 'success'" size="small" @click="doToggle(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-tooltip :disabled="!itemReferenced(row.code)" content="该项目已被引用，只能停用">
              <span>
                <el-button v-if="can('dict.remove')" link type="danger" size="small" :disabled="itemReferenced(row.code)" @click="doRemove(row)">移除</el-button>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <el-table v-else :data="rows" size="small" border style="width:100%">
        <el-table-column prop="code" label="编码" width="86">
          <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="168">
          <template #default="{ row }">
            <span>{{ row.name }}</span>
            <el-tag v-if="specCount(row) > 1" size="small" type="info" effect="plain" style="margin-left:6px">
              {{ specCount(row) }} 个规格
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec" label="规格" width="108" />
        <el-table-column label="默认剂量" width="92" align="right">
          <template #default="{ row }">{{ row.dose }} {{ row.unit }}</template>
        </el-table-column>
        <el-table-column prop="usage" label="默认用法" width="92" />
        <el-table-column label="是否麻醉" width="96" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.isAnesthetic ? 'danger' : 'info'" :effect="row.isAnesthetic ? 'dark' : 'plain'">
              {{ row.isAnesthetic ? '麻醉药' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="82" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <el-button v-if="can('dict.edit')" link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="can('dict.toggle')" link :type="row.enabled ? 'warning' : 'success'" size="small" @click="doToggle(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
            <el-tooltip :disabled="!drugReferenced(row.code)" content="该药品已被医嘱引用，只能停用">
              <span>
                <el-button v-if="can('dict.remove')" link type="danger" size="small" :disabled="drugReferenced(row.code)" @click="doRemove(row)">移除</el-button>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <div class="notice-bar mt12">
        <el-icon><InfoFilled /></el-icon>
        「是否麻醉」为开关：修改后立即影响手术医嘱页面的红色「麻醉」标签，可现场验证联动。
      </div>
    </div>

    <el-drawer v-model="dlg" :title="editing ? '编辑' + (tab === 'item' ? '收费项目' : '药品') : '新增' + (tab === 'item' ? '收费项目' : '药品')" size="480px">
      <el-form label-width="96px">
        <el-form-item label="编码" required>
          <el-input v-model="form.code" :disabled="!!editing" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" />
          <div class="tiny muted" v-if="tab === 'drug' && sameNameRows.length">
            已有同药品规格：{{ sameNameRows.map(r => r.spec).join('、') }}（医嘱录入时可在「规格」下拉中切换）
          </div>
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="form.spec" />
          <div class="tiny muted" v-if="tab === 'drug'">同一药品的不同包装规格请新增为不同编码（名称相同），医嘱录入页即可切换规格</div>
        </el-form-item>
        <template v-if="tab === 'item'">
          <el-form-item label="单位"><el-input v-model="form.unit" /></el-form-item>
          <el-form-item label="单价"><el-input-number v-model="form.price" :min="0" :precision="2" style="width:100%" /></el-form-item>
          <el-form-item label="类别">
            <el-select v-model="form.category" style="width:100%">
              <el-option v-for="c in CHARGE_CATEGORIES" :key="c" :label="c" :value="c" />
            </el-select>
          </el-form-item>
        </template>
        <template v-else>
          <el-form-item label="默认剂量"><el-input-number v-model="form.dose" :min="0" style="width:100%" /></el-form-item>
          <el-form-item label="单位"><el-input v-model="form.unit" /></el-form-item>
          <el-form-item label="默认用法">
            <el-select v-model="form.usage" style="width:100%">
              <el-option v-for="u in USAGES" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否麻醉药"><el-switch v-model="form.isAnesthetic" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { can } from '@/store/session'
import { ElMessage } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { fmtAmount } from '@/utils/format'
import * as dict from '@/store/dicts'
import { CHARGE_CATEGORIES, USAGES } from '@/mock/dict'

const tab = ref('item')
const kw = ref('')
const category = ref('')
const status = ref('')
const dlg = ref(false)
const editing = ref(null)
const form = reactive({ code: '', name: '', spec: '', unit: '次', price: 0, category: '手术费', dose: 0, usage: '静注', isAnesthetic: false })

const rows = computed(() => {
  const list = tab.value === 'item' ? dict.items.value : dict.drugs.value
  return list
    .filter((r) => !r.removed)
    .filter((r) => !kw.value || r.code.includes(kw.value) || r.name.includes(kw.value))
    .filter((r) => {
      if (!category.value) return true
      if (tab.value === 'item') return r.category === category.value
      return category.value === '麻醉药' ? r.isAnesthetic : !r.isAnesthetic
    })
    .filter((r) => !status.value || String(r.enabled ? 1 : 0) === status.value)
})

const itemReferenced = (code) => dict.itemReferenced(code)
const drugReferenced = (code) => dict.drugReferenced(code)

/** 同一种药的规格条数（名称相同、编码不同 = 不同包装规格） */
const specCount = (row) => dict.drugs.value.filter((d) => !d.removed && d.name === row.name).length
/** 新增/编辑药品时，同名药品已存在的其他规格 */
const sameNameRows = computed(() => {
  if (tab.value !== 'drug' || !form.name) return []
  return dict.drugs.value.filter((d) => !d.removed && d.name === form.name && d.code !== form.code)
})

function resetFilter() {
  kw.value = ''
  category.value = ''
  status.value = ''
}

function openAdd() {
  editing.value = null
  Object.assign(form, tab.value === 'item'
    ? { code: '', name: '', spec: '', unit: '次', price: 0, category: '手术费' }
    : { code: '', name: '', spec: '', unit: 'mg', dose: 0, usage: '静注', isAnesthetic: false })
  dlg.value = true
}

function openEdit(row) {
  editing.value = row
  Object.assign(form, row)
  dlg.value = true
}

function save() {
  if (!form.code || !form.name) return ElMessage.warning('编码与名称为必填项')
  try {
    if (tab.value === 'item') {
      if (editing.value) dict.patchDict('item', editing.value.code, { ...form }, '修改收费项目')
      else dict.addItem({ ...form })
      ElMessage.success(editing.value ? `已保存「${form.name}」` : `已新增收费项目「${form.name}」，编码 ${form.code}`)
    } else {
      if (editing.value) dict.patchDict('drug', editing.value.code, { ...form }, '修改药品字典')
      else dict.addDrug({ ...form })
      ElMessage.success(editing.value ? `已保存「${form.name}」` : `已新增药品「${form.name}」，编码 ${form.code}`)
    }
    dlg.value = false
  } catch (e) { ElMessage.error(e.message) }
}

function doToggle(row) {
  try {
    dict.toggle(tab.value === 'item' ? 'item' : 'drug', row.code)
    ElMessage.success(row.enabled ? `已启用「${row.name}」` : `已停用「${row.name}」，历史单据仍显示名称`)
  } catch (e) { ElMessage.error(e.message) }
}

function doRemove(row) {
  try {
    dict.removeItem(tab.value === 'item' ? 'item' : 'drug', row.code, '移除未被引用的字典项')
    ElMessage.warning(`已移除「${row.name}」（软删，记录保留）`)
  } catch (e) { ElMessage.error(e.message) }
}
</script>
