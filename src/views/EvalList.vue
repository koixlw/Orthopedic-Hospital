<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">术前评估</div>
        <div class="card-sub">先查后评：按评估状态检索患者，进入详情页完成专科 / 麻醉评估</div>
      </div>

      <el-tabs v-model="tab" @tab-change="onTab">
        <el-tab-pane v-for="s in EVAL_STATUS_ORDER" :key="s" :name="s">
          <template #label>
            {{ EVAL_STATUS[s].label }}
            <span class="tiny">（{{ counts[s] }}）</span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <div class="toolbar">
        <el-input v-model="filters.keyword" placeholder="姓名 / 住院号 / 术式" clearable :prefix-icon="Search" style="width:220px" />
        <el-select v-model="filters.dept" placeholder="科室" clearable style="width:140px">
          <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
        </el-select>
        <el-select v-model="filters.sort" placeholder="排序" style="width:150px">
          <el-option label="按拟手术日排序" value="planned" />
          <el-option label="按报告完成度排序" value="progress" />
          <el-option label="按留痕时间排序" value="log" />
        </el-select>
        <el-button :icon="RefreshLeft" @click="resetFilters">清空筛选</el-button>
        <span class="muted" style="margin-left:auto">共 {{ rows.length }} 条</span>
      </div>

      <div class="hint-box info" style="margin-bottom:10px">
        <el-icon><InfoFilled /></el-icon>
        <div>
          「报告未完成 / 待专科评估 / 待麻醉评估」为进行中状态，全部操作写入留痕且<strong>不可撤销</strong>；
          「已完成 / 评估不通过」的记录仅供查看，不提供撤销操作。
        </div>
      </div>

      <el-table :data="paged" size="small" border style="width:100%" row-key="patientId">
        <el-table-column label="患者" width="126">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div class="tiny mono">{{ row.inpatientNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="科室" width="104" prop="dept" />
        <el-table-column prop="surgeryName" label="手术名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="拟手术日" width="98">
          <template #default="{ row }"><span class="num">{{ row.plannedSurgeryDate || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="报告完成度" width="132">
          <template #default="{ row }">
            <div class="flex gap6" style="align-items:center">
              <el-progress
                :percentage="progressOf(row).pct"
                :show-text="false"
                :stroke-width="7"
                :color="progressOf(row).done < progressOf(row).total ? '#e6a23c' : '#67c23a'"
                style="flex:1;min-width:0"
              />
              <span class="num" style="width:36px;text-align:right">
                {{ progressOf(row).done }}/{{ progressOf(row).total }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="评估状态" width="96" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="EVAL_STATUS[statusOf(row)].type">{{ EVAL_STATUS[statusOf(row)].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近留痕" min-width="196">
          <template #default="{ row }">
            <template v-if="lastTrace(row)">
              <div class="num">{{ lastTrace(row).time.slice(0, 16) }} · {{ lastTrace(row).operator }}</div>
              <div class="tiny">{{ lastTrace(row).reason || ACTION_LABEL[lastTrace(row).action] || lastTrace(row).action }}</div>
            </template>
            <span v-else class="muted">暂无留痕</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goDetail(row)">
              {{ EVAL_STATUS[statusOf(row)].action }}
            </el-button>
            <el-button link type="info" size="small" @click="openTrace(row)">留痕</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty">
            <div class="big">—</div>
            该状态下暂无患者
          </div>
        </template>
      </el-table>

      <div class="flex mt12" style="justify-content:flex-end">
        <el-pagination
          v-model:current-page="page"
          :page-size="PAGE_SIZE"
          :total="rows.length"
          layout="total, prev, pager, next"
          background
          size="small"
        />
      </div>
    </div>

    <!-- 留痕明细 -->
    <el-drawer v-model="traceDlg" title="评估留痕" size="620px">
      <div v-if="traceTarget">
        <div class="hint-box info" style="margin-bottom:10px">
          <el-icon><InfoFilled /></el-icon>
          <div>{{ traceTarget.name }}（{{ traceTarget.inpatientNo }}）的评估相关留痕，只追加、不可修改。</div>
        </div>
        <el-table :data="traceRows" size="small" border>
          <el-table-column label="时间" width="140">
            <template #default="{ row }"><span class="num">{{ row.time.slice(0, 16) }}</span></template>
          </el-table-column>
          <el-table-column label="操作人" width="92" prop="operator" />
          <el-table-column label="动作" width="86" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ ACTION_LABEL[row.action] || row.action }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="原因 / 说明" min-width="200" show-overflow-tooltip />
          <el-table-column label="结果" width="66" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.result === 'FAIL' ? '#c53030' : '#2f855a' }">
                {{ row.result === 'FAIL' ? '失败' : '成功' }}
              </span>
            </template>
          </el-table-column>
          <template #empty><div class="empty">该患者暂无评估留痕</div></template>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, RefreshLeft, InfoFilled } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { EVAL_STATUS, EVAL_STATUS_ORDER, statusOf, listByStatus } from '@/store/evals'
import { queryByPatient } from '@/store/logs'
import { ACTION_LABEL } from '@/utils/audit'

const PAGE_SIZE = 10

const router = useRouter()
const tab = ref('REPORT_PENDING')
const page = ref(1)
const filters = reactive({ keyword: '', dept: '', sort: 'planned' })
const traceDlg = ref(false)
const traceTarget = ref(null)

const deptOptions = computed(() => [...new Set(state.patients.map((p) => p.dept).filter(Boolean))])

const counts = computed(() => {
  const out = {}
  EVAL_STATUS_ORDER.forEach((s) => { out[s] = listByStatus(s).length })
  return out
})

const progressOf = (p) => {
  const rp = p.reportProgress || { done: 4, total: 4 }
  const total = Number(rp.total || 0)
  const done = Number(rp.done || 0)
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** 该患者最近一条留痕（按时间倒序取最新） */
const lastTrace = (p) => {
  const list = queryByPatient(p.patientId)
  return list.length ? list[list.length - 1] : null
}

const rows = computed(() => {
  const kw = filters.keyword.trim()
  let list = listByStatus(tab.value).filter((p) => {
    if (kw && !(p.name.includes(kw) || p.inpatientNo.includes(kw) || (p.surgeryName || '').includes(kw))) return false
    if (filters.dept && p.dept !== filters.dept) return false
    return true
  })
  if (filters.sort === 'planned') {
    list = list.slice().sort((a, b) => String(a.plannedSurgeryDate || '').localeCompare(String(b.plannedSurgeryDate || '')))
  } else if (filters.sort === 'progress') {
    list = list.slice().sort((a, b) => {
      const pa = progressOf(a), pb = progressOf(b)
      return (pa.done / (pa.total || 1)) - (pb.done / (pb.total || 1))
    })
  } else {
    list = list.slice().sort((a, b) => {
      const ta = lastTrace(a)?.time || ''
      const tb = lastTrace(b)?.time || ''
      return String(tb).localeCompare(String(ta))
    })
  }
  return list
})

const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return rows.value.slice(start, start + PAGE_SIZE)
})

const traceRows = computed(() => {
  if (!traceTarget.value) return []
  return queryByPatient(traceTarget.value.patientId)
    .slice()
    .sort((a, b) => String(b.time).localeCompare(String(a.time)) || b.seq - a.seq)
})

watch(rows, () => { page.value = 1 })
watch(tab, () => { page.value = 1 })

function onTab() { page.value = 1 }

function resetFilters() {
  filters.keyword = ''
  filters.dept = ''
  filters.sort = 'planned'
  page.value = 1
}

function goDetail(row) {
  router.push('/evaluation/' + row.patientId)
}

function openTrace(row) {
  traceTarget.value = row
  traceDlg.value = true
}
</script>
