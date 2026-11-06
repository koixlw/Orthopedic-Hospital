<template>
  <div class="card">
    <div class="pick-toolbar">
      <el-input v-model="kw" clearable :prefix-icon="Search" placeholder="搜索患者姓名 / 住院号 / 手术名称 / 主刀医师"
        style="width:320px" />
      <el-select v-model="status" clearable placeholder="患者状态" style="width:130px">
        <el-option v-for="(v, k) in PATIENT_STATUS" :key="k" :label="v.label" :value="k" />
      </el-select>
      <span class="tiny muted">共 {{ list.length }} 位患者</span>
    </div>

    <el-table :data="list" size="small" border style="width:100%" @row-click="go" class="pick-table"
      :empty-text="'没有符合条件的患者'">
      <el-table-column label="患者" width="180">
        <template #default="{ row }">
          <b>{{ row.name }}</b>
          <span class="mono tiny" style="margin-left:8px">{{ row.inpatientNo }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="tagType(row.status)" effect="light">{{ labelOf(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="手术名称" min-width="180">
        <template #default="{ row }">{{ row.surgeryName }}</template>
      </el-table-column>
      <el-table-column label="主刀" width="90">
        <template #default="{ row }">{{ row.surgeon }}</template>
      </el-table-column>
      <el-table-column label="手术间" width="110">
        <template #default="{ row }">{{ row.surgeryRoom || '—' }}</template>
      </el-table-column>
      <el-table-column label="拟手术日" width="110">
        <template #default="{ row }"><span class="num">{{ row.plannedSurgeryDate }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="go(row)">进入</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { PATIENT_STATUS } from '@/mock/dict'

const props = defineProps({
  to: { type: String, required: true },
  statuses: { type: Array, default: () => ['ADMITTED', 'IN_SURGERY', 'SCHEDULED'] }
})

const router = useRouter()
const kw = ref('')
const status = ref('')

const list = computed(() => state.patients
  .filter((p) => props.statuses.includes(p.status))
  .filter((p) => !status.value || p.status === status.value)
  .filter((p) => {
    const k = kw.value.trim().toLowerCase()
    if (!k) return true
    return [p.name, p.inpatientNo, p.surgeryName, p.surgeon].some((v) => (v || '').toLowerCase().includes(k))
  }))

const labelOf = (s) => PATIENT_STATUS[s]?.label || s
const tagType = (s) => ({ SCHEDULED: 'warning', ADMITTED: 'success', IN_SURGERY: 'danger' }[s] || 'info')

function go(p) {
  router.push(`${props.to}/${p.patientId}`)
}
</script>

<style scoped>
.pick-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.pick-table :deep(.el-table__row) { cursor: pointer; }
</style>
