<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">手术查询</div>
        <div class="card-sub">按手术台次检索麻醉与术后数据，生成麻醉统计报表 / 术后统计报表</div>
      </div>

      <!-- 查询条件 -->
      <div class="toolbar">
        <el-date-picker v-model="range" type="daterange" size="default" range-separator="至"
          start-placeholder="手术日期起" end-placeholder="手术日期止" value-format="YYYY-MM-DD"
          style="width:260px" :clearable="true" />
        <el-select v-model="room" placeholder="手术间" clearable style="width:140px">
          <el-option v-for="r in rooms" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select v-model="anesthesia" placeholder="麻醉方式" clearable style="width:150px">
          <el-option v-for="a in ANESTHESIA_TYPES" :key="a" :label="a" :value="a" />
        </el-select>
        <el-input v-model="kw" placeholder="住院号 / 姓名 / 手术名称" clearable :prefix-icon="Search"
          style="width:220px" @keyup.enter="doQuery" />
        <el-button type="primary" :icon="Search" @click="doQuery">查询</el-button>
        <el-button :icon="RefreshLeft" @click="resetFilters">清空筛选</el-button>
        <span class="muted" style="margin-left:auto">共 {{ rows.length }} 台手术</span>
      </div>

      <!-- 统计页签：麻醉统计报表 / 术后统计报表 -->
      <el-tabs v-model="tab">
        <!-- ============ 麻醉统计报表 ============ -->
        <el-tab-pane label="麻醉统计报表" name="anesthesia">
          <div class="stat-cards">
            <div class="stat-card">
              <div class="num">{{ rows.length }}</div>
              <div class="lbl">手术台次</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ anesthesiaKinds.length }}</div>
              <div class="lbl">麻醉方式种数</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ anesthesiologists.length }}</div>
              <div class="lbl">麻醉医师</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ anesthesiaRate }}</div>
              <div class="lbl">麻醉手术占比</div>
            </div>
          </div>

          <div class="section-h">麻醉方式分布<span class="src">按手术台次汇总，占比 = 该麻醉台次 / 总台次</span></div>
          <el-table :data="anesthesiaDist" size="small" border style="width:100%;max-width:720px">
            <el-table-column prop="type" label="麻醉方式" min-width="140" />
            <el-table-column prop="count" label="台次" width="90" align="center" />
            <el-table-column label="占比" width="180">
              <template #default="{ row }">
                <el-progress :percentage="row.pct" :stroke-width="12" :format="() => row.pct + '%'" />
              </template>
            </el-table-column>
            <template #empty><div class="empty">暂无数据</div></template>
          </el-table>

          <div class="section-h mt16">麻醉明细<span class="src">与排程 / HIS 麻醉单一致，可按麻醉方式、手术间、日期筛选</span></div>
          <el-table :data="rows" size="small" border style="width:100%">
            <el-table-column label="患者" width="120">
              <template #default="{ row }">
                <div>{{ row.name }}</div>
                <div class="tiny mono">{{ row.inpatientNo }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="surgeryName" label="手术名称" min-width="170" show-overflow-tooltip />
            <el-table-column label="手术日期" width="98">
              <template #default="{ row }"><span class="num">{{ row.surgeryDate }}</span></template>
            </el-table-column>
            <el-table-column prop="room" label="手术间" width="104" />
            <el-table-column prop="seq" label="台次" width="62" align="center" />
            <el-table-column prop="anesthesiaType" label="麻醉方式" width="120">
              <template #default="{ row }">
                <el-tag size="small" effect="plain" type="primary">{{ row.anesthesiaType || '—' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="anesthesiologist" label="麻醉医师" width="94" />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="SCH_STATUS[row.status]?.type || 'info'">
                  {{ SCH_STATUS[row.status]?.label || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <template #empty><div class="empty">暂无数据</div></template>
          </el-table>
        </el-tab-pane>

        <!-- ============ 术后统计报表 ============ -->
        <el-tab-pane label="术后统计报表" name="postop">
          <div class="stat-cards">
            <div class="stat-card">
              <div class="num">{{ finishedCount }}</div>
              <div class="lbl">已完成手术</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ outcomeCount.当日离院 }}</div>
              <div class="lbl">当日离院</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ outcomeCount.转普通住院 }}</div>
              <div class="lbl">转普通住院</div>
            </div>
            <div class="stat-card">
              <div class="num">{{ dischargeRate }}</div>
              <div class="lbl">当日离院率</div>
            </div>
          </div>

          <div class="section-h">术后转归分布<span class="src">按患者状态机口径统计：已出院=当日离院、普通住院=转普通住院、已退出=退出日间手术</span></div>
          <el-table :data="outcomeDist" size="small" border style="width:100%;max-width:720px">
            <el-table-column prop="type" label="术后转归" min-width="140" />
            <el-table-column prop="count" label="例数" width="90" align="center" />
            <el-table-column label="占比" width="180">
              <template #default="{ row }">
                <el-progress :percentage="row.pct" :stroke-width="12" :format="() => row.pct + '%'" />
              </template>
            </el-table-column>
            <template #empty><div class="empty">暂无数据</div></template>
          </el-table>

          <div class="section-h mt16">主刀医师统计<span class="src">按主刀汇总完成台次与转归</span></div>
          <el-table :data="surgeonDist" size="small" border style="width:100%;max-width:720px">
            <el-table-column prop="surgeon" label="主刀医师" min-width="110" />
            <el-table-column prop="total" label="台次" width="80" align="center" />
            <el-table-column prop="discharged" label="当日离院" width="90" align="center" />
            <el-table-column prop="transferred" label="转普通住院" width="100" align="center" />
            <el-table-column prop="ongoing" label="在院 / 未结束" width="110" align="center" />
            <template #empty><div class="empty">暂无数据</div></template>
          </el-table>

          <div class="section-h mt16">术后明细<span class="src">术后转归实时取自患者状态，与患者轨迹一致</span></div>
          <el-table :data="rows" size="small" border style="width:100%">
            <el-table-column label="患者" width="120">
              <template #default="{ row }">
                <div>{{ row.name }}</div>
                <div class="tiny mono">{{ row.inpatientNo }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="surgeryName" label="手术名称" min-width="170" show-overflow-tooltip />
            <el-table-column label="手术日期" width="98">
              <template #default="{ row }"><span class="num">{{ row.surgeryDate }}</span></template>
            </el-table-column>
            <el-table-column prop="surgeon" label="主刀医师" width="94" />
            <el-table-column prop="dept" label="科室" width="104" />
            <el-table-column label="术后转归" width="116" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="outcomeOf(row).type" effect="plain">{{ outcomeOf(row).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="当前状态" width="94" align="center">
              <template #default="{ row }">
                <el-tag size="small" :type="PATIENT_STATUS[row.pstatus]?.type || 'info'">
                  {{ PATIENT_STATUS[row.pstatus]?.label || row.pstatus }}
                </el-tag>
              </template>
            </el-table-column>
            <template #empty><div class="empty">暂无数据</div></template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { STATUS_MAP as SCH_STATUS } from '@/store/schedules'
import { PATIENT_STATUS } from '@/mock/dict'
import { fmtDate } from '@/utils/format'

const tab = ref('anesthesia')
const kw = ref('')
const room = ref('')
const anesthesia = ref('')
// 默认统计近 14 天
const range = ref([fmtDate(new Date(Date.now() - 13 * 86400000)), fmtDate(new Date())])

const ANESTHESIA_TYPES = ['全身麻醉', '椎管内麻醉', '神经阻滞', '局部浸润麻醉', '静脉麻醉']

const rooms = computed(() => Array.from(new Set(state.schedules.map((s) => s.room))).sort())

/** 过滤后的手术台次（排程 × 患者档案），两张报表共用同一份结果集 */
const rows = computed(() => state.schedules
  .filter((s) => s.status !== 'CANCELLED')
  .map((s) => {
    const p = state.patients.find((x) => x.patientId === s.patientId)
    if (!p) return null
    return {
      ...s,
      name: p.name, inpatientNo: p.inpatientNo, dept: p.dept,
      pstatus: p.status, surgeryName: s.surgeryName || p.surgeryName
    }
  })
  .filter(Boolean)
  .filter((r) => {
    if (range.value && range.value[0] && r.surgeryDate < range.value[0]) return false
    if (range.value && range.value[1] && r.surgeryDate > range.value[1]) return false
    if (room.value && r.room !== room.value) return false
    if (anesthesia.value && r.anesthesiaType !== anesthesia.value) return false
    const k = kw.value.trim()
    if (k && !(r.name.includes(k) || r.inpatientNo.includes(k) || (r.surgeryName || '').includes(k))) return false
    return true
  })
  .sort((a, b) => (a.surgeryDate < b.surgeryDate ? 1 : -1)))

function doQuery() {
  if (!rows.value.length) ElMessage.info('按当前条件未查询到手术台次，可放宽日期范围')
}

function resetFilters() {
  kw.value = ''
  room.value = ''
  anesthesia.value = ''
  range.value = [fmtDate(new Date(Date.now() - 13 * 86400000)), fmtDate(new Date())]
}

/* ---------------- 麻醉统计 ---------------- */
const anesthesiaKinds = computed(() => Array.from(new Set(rows.value.map((r) => r.anesthesiaType).filter(Boolean))))
const anesthesiologists = computed(() => Array.from(new Set(rows.value.map((r) => r.anesthesiologist).filter(Boolean))))
const anesthesiaRate = computed(() => {
  if (!rows.value.length) return '0%'
  const n = rows.value.filter((r) => r.anesthesiaType && r.anesthesiaType !== '局部浸润麻醉' ||
    state.applies.some((a) => a.patientId === r.patientId && a.bizMode === '手术麻醉')).length
  return Math.round((n / rows.value.length) * 100) + '%'
})

const anesthesiaDist = computed(() => {
  const total = rows.value.length
  const map = {}
  rows.value.forEach((r) => {
    const key = r.anesthesiaType || '未登记'
    map[key] = (map[key] || 0) + 1
  })
  return Object.entries(map)
    .map(([type, count]) => ({ type, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
})

/* ---------------- 术后统计 ---------------- */
/** 术后转归口径：与 8 态状态机一致 */
function outcomeOf(row) {
  const s = row.pstatus
  if (s === 'DISCHARGED') return { label: '当日离院', type: 'success' }
  if (s === 'TRANSFERRED') return { label: '转普通住院', type: 'warning' }
  if (s === 'WITHDRAWN') return { label: '退出日间手术', type: 'info' }
  return { label: '在院 / 未结束', type: 'primary' }
}

const finishedCount = computed(() => rows.value.filter((r) => ['DISCHARGED', 'TRANSFERRED'].includes(r.pstatus)).length)
const outcomeCount = computed(() => {
  const c = { 当日离院: 0, 转普通住院: 0, 退出日间手术: 0, '在院 / 未结束': 0 }
  rows.value.forEach((r) => { c[outcomeOf(r).label]++ })
  return c
})
const dischargeRate = computed(() => {
  const ended = finishedCount.value + outcomeCount.value['退出日间手术']
  return ended ? Math.round((outcomeCount.value['当日离院'] / ended) * 100) + '%' : '—'
})

const outcomeDist = computed(() => {
  const total = rows.value.length
  const order = ['当日离院', '转普通住院', '退出日间手术', '在院 / 未结束']
  return order.map((type) => ({
    type, count: outcomeCount.value[type],
    pct: total ? Math.round((outcomeCount.value[type] / total) * 100) : 0
  }))
})

const surgeonDist = computed(() => {
  const map = {}
  rows.value.forEach((r) => {
    const key = r.surgeon || '—'
    map[key] = map[key] || { surgeon: key, total: 0, discharged: 0, transferred: 0, ongoing: 0 }
    const it = map[key]
    it.total++
    const o = outcomeOf(r).label
    if (o === '当日离院') it.discharged++
    else if (o === '转普通住院') it.transferred++
    else it.ongoing++
  })
  return Object.values(map).sort((a, b) => b.total - a.total)
})
</script>

<style scoped>
.stat-cards { display: flex; gap: 12px; margin-bottom: 14px; }
.stat-card {
  flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; background: #fafbfd;
}
.stat-card .num { font-size: 24px; font-weight: 700; color: #2b6cb0; }
.stat-card .lbl { font-size: 12px; color: #8a94a6; margin-top: 4px; }
</style>
