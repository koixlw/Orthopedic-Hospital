<template>
  <div class="cols" style="grid-template-columns:280px 1fr">
    <div class="card" style="align-self:start">
      <div class="card-head"><div class="card-title">费用常用组套</div></div>
      <div v-for="g in list" :key="g.groupId" class="group-item" :class="{ active: g.groupId === currentId }" @click="select(g.groupId)">
        <div class="flex" style="justify-content:space-between">
          <span style="font-weight:600;font-size:12.5px">{{ g.name }}</span>
          <el-tag size="small" :type="g.enabled ? 'success' : 'info'">{{ g.enabled ? '启用' : '停用' }}</el-tag>
        </div>
        <div class="tiny mt8">{{ g.lines.length }} 项 · 合计 ¥{{ fmtAmount(g.total) }}</div>
      </div>
    </div>

    <div class="card" v-if="current">
      <div class="card-head">
        <div class="card-title">{{ current.name }}</div>
        <div class="right">
          <el-button size="small" @click="openPick">从收费项目添加</el-button>
          <el-button size="small" @click="addBlank">手工添加一行</el-button>
        </div>
      </div>

      <div class="toolbar">
        <span class="muted">组套名称</span>
        <el-input v-model="name" style="width:280px" />
        <span class="tiny">名称重复将无法保存</span>
      </div>

      <el-table :data="lines" size="small" border style="width:100%">
        <el-table-column prop="name" label="收费项目" min-width="200" />
        <el-table-column prop="spec" label="规格" width="110" />
        <el-table-column prop="unit" label="单位" width="66" align="center" />
        <el-table-column label="数量" width="110" align="center">
          <template #default="{ row }">
            <el-input-number v-model="row.qty" :min="1" size="small" controls-position="right" style="width:92px" @change="recalc" />
          </template>
        </el-table-column>
        <el-table-column label="单价" width="110" align="right">
          <template #default="{ $index, row }">
            <el-input-number v-model="row.price" :min="0" :precision="2" size="small" controls-position="right"
              style="width:96px" @change="recalc" />
          </template>
        </el-table-column>
        <el-table-column label="金额" width="116" align="right">
          <template #default="{ row }"><span class="num">¥{{ fmtAmount(row.qty * row.price) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeLine($index)">移除</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="empty">该组套暂无明细</div></template>
      </el-table>

      <div class="flex mt12" style="justify-content:space-between;align-items:center">
        <div>
          <span class="muted">合计</span>
          <span class="amount-big" style="margin-left:8px">¥{{ fmtAmount(total) }}</span>
          <span class="muted" style="margin-left:8px">共 {{ lines.length }} 项</span>
        </div>
        <div class="flex gap8">
          <el-button @click="doToggle">{{ current.enabled ? '停用组套' : '启用组套' }}</el-button>
          <el-button type="primary" @click="doSave">保存组套</el-button>
        </div>
      </div>
      <div class="notice-bar mt12">
        <el-icon><InfoFilled /></el-icon>
        合计始终等于明细金额之和，保存前自动校验；改组套后回手术费用页重新调入，带出的即为最新明细。
      </div>
    </div>

    <el-dialog v-model="pickDlg" title="从收费项目添加" width="640px">
      <el-input v-model="pickKw" placeholder="搜索编码或名称" :prefix-icon="Search" style="margin-bottom:10px" />
      <el-table :data="pickRows" size="small" border height="360" @selection-change="(v) => (picked = v)">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="code" label="编码" width="92" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="spec" label="规格" width="110" />
        <el-table-column label="单价" width="100" align="right">
          <template #default="{ row }">¥{{ fmtAmount(row.price) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="pickDlg = false">取消</el-button>
        <el-button type="primary" :disabled="!picked.length" @click="doPick">添加 {{ picked.length }} 项</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { fmtAmount, round2 } from '@/utils/format'
import * as dict from '@/store/dicts'
import { state } from '@/store/db'

const list = computed(() => dict.groups.value.filter((g) => !g.removed))
const currentId = ref(list.value[0]?.groupId || '')
const current = computed(() => list.value.find((g) => g.groupId === currentId.value) || null)
const lines = ref([])
const name = ref('')
const pickDlg = ref(false)
const pickKw = ref('')
const picked = ref([])

const total = computed(() => round2(lines.value.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0)))
const pickRows = computed(() => dict.items.value
  .filter((i) => i.enabled)
  .filter((i) => !pickKw.value || i.name.includes(pickKw.value) || i.code.includes(pickKw.value)))

function select(id) {
  currentId.value = id
}

watch(current, (g) => {
  if (!g) return
  name.value = g.name
  lines.value = g.lines.map((l) => ({ ...l }))
}, { immediate: true })

function recalc() { /* 金额为计算属性，无需手动重算 */ }

function removeLine(idx) {
  // 仅作用于「编辑中的组套草稿」，不触碰已保存的组套与费用数据；语义为移除明细行
  lines.value = lines.value.filter((_, i) => i !== idx)
  ElMessage.info('已从当前组套草稿中移除该明细，保存后生效')
}

function addBlank() {
  lines.value.push({ code: '', name: '手工项目', spec: '—', unit: '项', qty: 1, price: 0 })
}

function openPick() { pickDlg.value = true; picked.value = [] }

function doPick() {
  picked.value.forEach((it) => {
    lines.value.push({ code: it.code, name: it.name, spec: it.spec, unit: it.unit, qty: 1, price: it.price })
  })
  pickDlg.value = false
  ElMessage.success(`已添加 ${picked.value.length} 项，合计已重算`)
}

function doSave() {
  if (!name.value.trim()) return ElMessage.warning('请填写组套名称')
  if (list.value.some((g) => g.groupId !== currentId.value && g.name === name.value.trim())) {
    return ElMessage.warning('组套名称已存在')
  }
  if (!lines.value.length) return ElMessage.warning('组套至少需要一条明细')
  try {
    dict.saveGroup(currentId.value, { name: name.value.trim(), lines: lines.value })
    ElMessage.success(`组套「${name.value}」已保存，合计 ¥${fmtAmount(total.value)}`)
  } catch (e) { ElMessage.error(e.message) }
}

function doToggle() {
  try {
    dict.toggle('group', currentId.value)
    ElMessage.success(current.value.enabled ? '组套已启用' : '组套已停用')
  } catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.group-item {
  border: 1px solid var(--line); border-radius: 6px; padding: 9px 10px; margin-bottom: 8px; cursor: pointer;
}
.group-item:hover { border-color: #b9d3ec; background: #f8fbff; }
.group-item.active { border-color: #9dc3e6; background: var(--brand-soft); }
</style>
