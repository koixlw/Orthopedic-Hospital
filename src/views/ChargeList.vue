<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">手术费用</div>
        <div class="right">
          <el-select v-model="filters.sort" size="small" style="width:150px">
            <el-option label="按手术时间排序" value="surgery" />
            <el-option label="按费用合计排序" value="amount" />
            <el-option label="按患者排序" value="patient" />
          </el-select>
        </div>
      </div>

      <div class="toolbar">
        <el-input v-model="filters.keyword" placeholder="姓名 / 住院号 / 术式" clearable :prefix-icon="Search" style="width:210px" />
        <el-select v-model="filters.room" placeholder="手术间" clearable style="width:120px">
          <el-option v-for="r in SURGERY_ROOMS" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select v-model="filters.surgeon" placeholder="主刀" clearable style="width:120px">
          <el-option v-for="s in surgeonOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="filters.chargeStatus" placeholder="费用状态" clearable style="width:130px">
          <el-option label="未录入" value="NONE" />
          <el-option label="编辑中" value="DRAFT" />
          <el-option label="已提交" value="SUBMITTED" />
          <el-option label="已作废" value="VOIDED" />
        </el-select>
        <el-date-picker v-model="filters.range" type="daterange" value-format="YYYY-MM-DD"
          start-placeholder="手术日始" end-placeholder="止" style="width:230px" />
        <el-button :icon="RefreshLeft" @click="resetFilters">清空筛选</el-button>
        <span class="muted" style="margin-left:auto">共 {{ rows.length }} 条</span>
      </div>

      <el-table :data="paged" size="small" border style="width:100%" row-key="patientId">
        <el-table-column label="患者" width="126">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div class="tiny mono">{{ row.inpatientNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="性别/年龄" width="84">
          <template #default="{ row }">{{ row.gender }} / {{ row.age }}</template>
        </el-table-column>
        <el-table-column prop="dept" label="科室" width="100" />
        <el-table-column prop="surgeryName" label="手术名称" min-width="150" show-overflow-tooltip />
        <el-table-column label="手术时间" width="156">
          <template #default="{ row }">
            <template v-if="row.surgeryDate">
              <div class="num">{{ row.surgeryDate }}</div>
              <div class="tiny">{{ row.room }} 第 {{ row.seq }} 台</div>
            </template>
            <span v-else class="muted">未排程</span>
          </template>
        </el-table-column>
        <el-table-column prop="surgeon" label="主刀" width="70" />
        <el-table-column label="患者状态" width="92" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="PATIENT_STATUS[row.status].type">{{ PATIENT_STATUS[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="费用状态" width="94" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="chargeTag(row)" effect="plain">{{ chargeLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="费用合计" width="112" align="right">
          <template #default="{ row }">
            <span class="num" :class="{ 'amount-red': row.chargeStatus === 'VOIDED' }">
              ¥{{ fmtAmount(row.chargeTotal) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-if="canEnter(row)" link type="primary" size="small" @click="go(row)">
              {{ row.chargeStatus === 'NONE' ? '录入费用' : '查看费用' }}
            </el-button>
            <el-button
              v-else
              link
              type="info"
              size="small"
              disabled
              title="仅「已入院 / 术中」患者可录入手术费用"
            >查看费用</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty">
            <div class="big">—</div>
            未查询到符合条件的患者
            <div class="mt8"><el-button link type="primary" @click="resetFilters">清空筛选</el-button></div>
          </div>
        </template>
      </el-table>

      <div class="flex mt12" style="justify-content:flex-end">
        <el-pagination
          v-model:current-page="page"
          :page-size="PAGE_SIZE"
          :total="rows.length"
          layout="total, prev, pager, next, jumper"
          background
          size="small"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { activeSchedule } from '@/store/patients'
import * as chg from '@/store/charges'
import { PATIENT_STATUS, SURGERY_ROOMS } from '@/mock/dict'
import { fmtAmount } from '@/utils/format'

// 单页最多 12 人，超出分页
const PAGE_SIZE = 12

const router = useRouter()
const page = ref(1)
const filters = reactive({ keyword: '', room: '', surgeon: '', chargeStatus: '', range: [], sort: 'surgery' })

// 可办理手术费用的患者：已入院 / 术中；其余患者仅供查看列表与状态
const SCOPE = ['ADMITTED', 'IN_SURGERY']

const surgeonOptions = computed(() => [...new Set(state.patients.map((p) => p.surgeon).filter(Boolean))])

const rows = computed(() => {
  const kw = filters.keyword.trim()
  let list = state.patients.filter((p) => {
    if (kw && !(p.name.includes(kw) || p.inpatientNo.includes(kw) || (p.surgeryName || '').includes(kw))) return false
    if (filters.surgeon && p.surgeon !== filters.surgeon) return false
    return true
  })

  // 补齐排程与费用单信息
  list = list.map((p) => {
    const sch = activeSchedule(p.patientId)
    const sheet = chg.active(p.patientId) || chg.listOf(p.patientId)[0] || null
    const status = sheet ? sheet.status : 'NONE'
    return {
      ...p,
      surgeryDate: sch ? sch.surgeryDate : '',
      room: sch ? sch.room : '',
      seq: sch ? sch.seq : '',
      chargeStatus: status,
      chargeTotal: sheet ? Number(sheet.total || 0) : 0
    }
  })

  if (filters.room) list = list.filter((r) => r.room === filters.room)
  if (filters.chargeStatus) list = list.filter((r) => r.chargeStatus === filters.chargeStatus)
  if (filters.range && filters.range.length === 2) {
    list = list.filter((r) => {
      const d = r.surgeryDate || r.plannedSurgeryDate || ''
      return d >= filters.range[0] && d <= filters.range[1]
    })
  }

  if (filters.sort === 'amount') {
    list = list.slice().sort((a, b) => b.chargeTotal - a.chargeTotal)
  } else if (filters.sort === 'patient') {
    list = list.slice().sort((a, b) => String(a.inpatientNo).localeCompare(String(b.inpatientNo)))
  } else {
    // 默认按手术时间排序：已排程的按手术日 + 台次，未排程的按拟手术日排在后面
    list = list.slice().sort((a, b) => {
      const ka = a.surgeryDate ? '0' + a.surgeryDate : '1' + (a.plannedSurgeryDate || '9999-99-99')
      const kb = b.surgeryDate ? '0' + b.surgeryDate : '1' + (b.plannedSurgeryDate || '9999-99-99')
      if (ka !== kb) return ka < kb ? -1 : 1
      return Number(a.seq || 0) - Number(b.seq || 0)
    })
  }
  return list
})

const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return rows.value.slice(start, start + PAGE_SIZE)
})

watch(rows, () => { page.value = 1 })

function chargeLabel(row) {
  return { DRAFT: '编辑中', SUBMITTED: '已提交', VOIDED: '已作废' }[row.chargeStatus] || '未录入'
}
function chargeTag(row) {
  return { DRAFT: 'primary', SUBMITTED: 'success', VOIDED: 'info' }[row.chargeStatus] || 'info'
}

// 已入院 / 术中可录入；已产生过费用单的其余患者可查看历史
function canEnter(row) {
  return SCOPE.includes(row.status) || row.chargeStatus !== 'NONE'
}

function resetFilters() {
  filters.keyword = ''
  filters.room = ''
  filters.surgeon = ''
  filters.chargeStatus = ''
  filters.range = []
  page.value = 1
}

function go(row) {
  router.push('/charge/' + row.patientId)
}
</script>
