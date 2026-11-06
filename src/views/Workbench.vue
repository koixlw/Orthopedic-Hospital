<template>
  <div>
    <div class="stat-grid">
      <div class="stat-card" @click="tab = 'scheduled'">
        <div class="ico"><el-icon><Calendar /></el-icon></div>
        <div>
          <div class="lbl">今日手术</div>
          <div class="val">{{ stats.todaySurgery }} <small>台</small></div>
        </div>
      </div>
      <div class="stat-card teal" @click="tab = 'unplanned'">
        <div class="ico"><el-icon><Clock /></el-icon></div>
        <div>
          <div class="lbl">待排程</div>
          <div class="val">{{ stats.waitingSchedule }} <small>人</small></div>
        </div>
      </div>
      <div class="stat-card orange" @click="can('evaluate') && go('/evaluation')">
        <div class="ico"><el-icon><FirstAidKit /></el-icon></div>
        <div>
          <div class="lbl">待评估</div>
          <div class="val">{{ stats.waitingEval }} <small>人</small></div>
        </div>
      </div>
      <div class="stat-card green" @click="go('/checkin')">
        <div class="ico"><el-icon><Postcard /></el-icon></div>
        <div>
          <div class="lbl">待报到</div>
          <div class="val">{{ stats.waitingCheckin }} <small>人</small></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">手术患者集中管理</div>
        <div class="card-sub">按手术安排状态检索，操作列随患者状态变化</div>
        <div class="right">
          <el-button v-if="can('apply.receive')" type="primary" :icon="DocumentAdd" @click="go('/apply')">接收 HIS 申请单</el-button>
          <el-button :icon="Download" @click="onExport">导出当前列表</el-button>
        </div>
      </div>

      <el-tabs v-model="tab">
        <el-tab-pane name="unplanned">
          <template #label>手术未安排 <span class="tiny">（{{ counts.unplanned }}）</span></template>
        </el-tab-pane>
        <el-tab-pane name="scheduled">
          <template #label>手术已安排 <span class="tiny">（{{ counts.scheduled }}）</span></template>
        </el-tab-pane>
        <el-tab-pane name="done">
          <template #label>手术已完成 <span class="tiny">（{{ counts.done }}）</span></template>
        </el-tab-pane>
        <el-tab-pane name="stat">
          <template #label>统计概览</template>
        </el-tab-pane>
      </el-tabs>

      <template v-if="tab !== 'stat'">
        <div class="toolbar">
          <el-input v-model="filters.keyword" placeholder="住院号 / 床号 / 姓名" clearable :prefix-icon="Search" style="width:210px" />
          <el-select v-model="filters.account" placeholder="账户状态" clearable style="width:140px">
            <el-option label="正常" value="NORMAL" />
            <el-option label="已冻结" value="FROZEN" />
            <el-option label="已转入住院" value="TRANSFERRED_IN" />
            <el-option label="已结算" value="SETTLED" />
          </el-select>
          <el-select v-model="filters.evalStatus" placeholder="评估状态" clearable style="width:140px">
            <el-option label="待评估" value="PENDING" />
            <el-option label="评估通过" value="PASSED" />
            <el-option label="评估不通过" value="FAILED" />
          </el-select>
          <el-date-picker v-model="filters.range" type="daterange" value-format="YYYY-MM-DD"
            start-placeholder="拟手术日始" end-placeholder="止" style="width:240px" />
          <el-button :icon="RefreshLeft" @click="resetFilters">清空筛选</el-button>
          <span class="muted" style="margin-left:auto">共 {{ rows.length }} 条</span>
        </div>

        <el-table :data="rows" size="small" border style="width:100%" row-key="patientId">
          <el-table-column prop="inpatientNo" label="住院号" width="104">
            <template #default="{ row }"><span class="mono">{{ row.inpatientNo }}</span></template>
          </el-table-column>
          <el-table-column label="床号" width="92">
            <template #default="{ row }">
              <el-input
                v-if="row._bedEditing"
                v-model="row._bed"
                size="small"
                @blur="saveBed(row)"
                @keyup.enter="saveBed(row)"
                v-focus
              />
              <span v-else style="color:#4b5563;cursor:pointer" @click="editBed(row)">
                {{ row.bedNo || '—' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="姓名" width="76" />
          <el-table-column label="性别/年龄" width="86">
            <template #default="{ row }">{{ row.gender }} / {{ row.age }}</template>
          </el-table-column>
          <el-table-column prop="surgeryName" label="手术名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="手术安排" width="176">
            <template #default="{ row }">
              <template v-if="scheduleOf(row.patientId)">
                <div class="num">{{ scheduleOf(row.patientId).surgeryDate }} · {{ scheduleOf(row.patientId).room }}</div>
                <div class="tiny">第 {{ scheduleOf(row.patientId).seq }} 台</div>
              </template>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="surgeon" label="主刀" width="70" />
          <el-table-column label="评估状态" width="96">
            <template #default="{ row }">
              <el-tag size="small" :type="evalOf(row).type" effect="light">{{ evalOf(row).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="储值金" width="104">
            <template #default="{ row }">
              <el-tag v-if="accountOf(row.patientId)" size="small" :type="accTag(row)" effect="plain">
                {{ accLabel(row) }}
              </el-tag>
              <span v-else class="muted">未开户</span>
            </template>
          </el-table-column>
          <el-table-column label="患者状态" width="92">
            <template #default="{ row }">
              <el-tag size="small" :type="PATIENT_STATUS[row.status].type">{{ PATIENT_STATUS[row.status].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="240" fixed="right">
            <template #default="{ row }">
              <div class="flex gap6" style="flex-wrap:wrap">
                <el-button v-if="row.status === 'APPLIED' && can('apply.build')" link type="primary" size="small" @click="go('/apply')">建档</el-button>

                <template v-if="row.status === 'DAY_SURGERY'">
                  <el-button v-if="row.evalStatus.specialist === 'FAILED' && can('evaluate')" link type="info" size="small"
                    @click="go('/evaluation/' + row.patientId)">查看评估</el-button>
                  <el-button v-else-if="row.evalStatus.specialist === 'PENDING' && can('evaluate')" link type="primary" size="small"
                    @click="go('/evaluation/' + row.patientId)">评估</el-button>
                  <el-button v-if="canSchedule(row) && can('sch.create')" link type="primary" size="small"
                    @click="go('/schedule?patient=' + row.patientId)">创建预约</el-button>
                  <el-button v-if="can('deposit')" link type="primary" size="small" @click="go('/deposit/' + row.patientId)">储值金</el-button>
                  <el-button v-if="can('dep.withdraw')" link type="danger" size="small" @click="openWithdraw(row)">退出</el-button>
                </template>

                <template v-if="row.status === 'SCHEDULED'">
                  <el-button v-if="can('admission')" link type="primary" size="small" @click="go('/admission/' + row.patientId)">入院登记</el-button>
                  <el-button v-if="can('sch.adjust')" link type="primary" size="small" @click="go('/schedule?patient=' + row.patientId)">调整安排</el-button>
                  <el-button link type="info" size="small" @click="go('/trace/' + row.patientId)">查看排程</el-button>
                </template>

                <template v-if="row.status === 'ADMITTED'">
                  <el-button link type="primary" size="small" @click="go('/checkin?patient=' + row.patientId)">报到</el-button>
                  <el-button link type="primary" size="small" @click="go('/charge/' + row.patientId)">手术费用</el-button>
                  <el-button link type="primary" size="small" @click="go('/order/' + row.patientId)">手术医嘱</el-button>
                  <el-button link type="warning" size="small" @click="go('/transfer/' + row.patientId)">转普通住院</el-button>
                </template>

                <template v-if="row.status === 'IN_SURGERY'">
                  <el-button link type="primary" size="small" @click="go('/charge/' + row.patientId)">手术费用</el-button>
                  <el-button link type="primary" size="small" @click="go('/order/' + row.patientId)">手术医嘱</el-button>
                  <el-button link type="warning" size="small" @click="go('/transfer/' + row.patientId)">转普通住院</el-button>
                </template>

                <el-button v-if="['TRANSFERRED','DISCHARGED','WITHDRAWN'].includes(row.status)" link type="info" size="small"
                  @click="go('/trace/' + row.patientId)">查看</el-button>
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty">
              <div class="big">—</div>
              {{ emptyText }}
              <div class="mt8"><el-button link type="primary" @click="resetFilters">清空筛选</el-button></div>
            </div>
          </template>
        </el-table>
      </template>

      <template v-else>
        <div class="cols c2">
          <div>
            <div class="kv" style="grid-template-columns:repeat(2,1fr);row-gap:16px">
              <div>
                <div class="tiny">本月手术台数</div>
                <div class="amount-big">{{ report.month }} <span class="tiny">台</span></div>
              </div>
              <div>
                <div class="tiny">已完成 / 已取消</div>
                <div class="amount-big" style="font-size:17px">{{ report.done }} / {{ report.cancelled }}</div>
              </div>
              <div>
                <div class="tiny">当日离院 / 转住院</div>
                <div class="amount-big" style="font-size:17px">{{ report.discharged }} / {{ report.transferred }}</div>
              </div>
              <div>
                <div class="tiny">退出日间手术</div>
                <div class="amount-big" style="font-size:17px">{{ report.withdrawn }}</div>
              </div>
            </div>
            <div class="divider-h"></div>
            <div class="tiny">麻醉方式分布</div>
            <div class="flex gap12 mt8">
              <el-tag v-for="(v, k) in report.anes" :key="k" :type="k === '全身麻醉' ? 'primary' : 'info'" effect="plain">
                {{ k }} {{ v }}
              </el-tag>
            </div>
          </div>
          <div>
            <div class="tiny mb8">按科室 / 医生 / 护士统计</div>
            <el-radio-group v-model="statBy" size="small" style="margin-bottom:8px">
              <el-radio-button label="科室" />
              <el-radio-button label="医生" />
              <el-radio-button label="护士" />
            </el-radio-group>
            <el-table :data="statRows" size="small" border>
              <el-table-column prop="name" :label="statBy" />
              <el-table-column prop="count" label="台数" width="70" align="right" />
              <el-table-column prop="transfer" label="转住院" width="74" align="right" />
              <el-table-column prop="withdraw" label="退出" width="64" align="right" />
            </el-table>
            <div class="tiny mt8">统计口径：按手术日期归属，已取消不计入台数。报表引擎版由正式系统提供。</div>
          </div>
        </div>
      </template>
    </div>

    <!-- 今日排台 + 最近操作：让首页下半屏也有内容，评审一眼看到"数据是活的" -->
    <div class="cols c2" style="margin-top:14px">
      <div class="card">
        <div class="card-head">
          <div class="card-title">今日手术排台</div>
          <div class="card-sub">按台次排序，与「手术排程」日视图同源</div>
          <div v-if="can('schedule')" class="right"><el-button text size="small" @click="go('/schedule')">进入排程</el-button></div>
        </div>
        <el-table :data="todayBoard" size="small" border style="width:100%">
          <el-table-column label="台次 · 手术间" width="140">
            <template #default="{ row }">第 {{ row.seq }} 台 · {{ row.room }}</template>
          </el-table-column>
          <el-table-column label="患者" width="122">
            <template #default="{ row }">
              <div>{{ pname(row.patientId) }}</div>
              <div class="tiny mono">{{ pno(row.patientId) }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="surgeon" label="主刀" width="76" />
          <el-table-column label="状态" width="92">
            <template #default="{ row }">
              <el-tag size="small" :type="SCH_STATUS[row.status]?.type || 'info'">{{ SCH_STATUS[row.status]?.label || row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="76" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="go('/trace/' + row.patientId)">轨迹</el-button>
            </template>
          </el-table-column>
          <template #empty><div class="empty">今日暂无手术排台</div></template>
        </el-table>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">最近操作</div>
          <div class="card-sub">全站留痕，只追加不可修改</div>
          <div v-if="can('log')" class="right"><el-button text size="small" @click="go('/log')">全部日志</el-button></div>
        </div>
        <el-table :data="recentLogs" size="small" border style="width:100%">
          <el-table-column label="时间" width="126">
            <template #default="{ row }"><span class="num">{{ row.time.slice(5, 16) }}</span></template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="76" />
          <el-table-column label="动作" width="80" align="center">
            <template #default="{ row }"><el-tag size="small" effect="plain">{{ ACTION_LABEL[row.action] || row.action }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="targetName" label="对象" min-width="130" show-overflow-tooltip />
          <el-table-column label="结果" width="66" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.result === 'FAIL' ? '#c53030' : '#2f855a' }">{{ row.result === 'FAIL' ? '失败' : '成功' }}</span>
            </template>
          </el-table-column>
          <template #empty><div class="empty">暂无操作记录</div></template>
        </el-table>
      </div>
    </div>

    <el-dialog v-model="withdrawDlg" title="退出日间手术" width="480px">
      <div v-if="withdrawTarget">
        <div class="hint-box">
          <el-icon><Warning /></el-icon>
          <div>
            将为患者 <b>{{ withdrawTarget.name }}（{{ withdrawTarget.inpatientNo }}）</b> 生成门诊结算单，
            冻结金额解冻后扣除已产生门诊费用，余额退回。退出后患者流程结束，不可再执行其他业务操作。
          </div>
        </div>
        <el-form label-width="88px" class="mt12">
          <el-form-item label="退出原因" required>
            <el-radio-group v-model="withdrawForm.reason">
              <el-radio v-for="r in WITHDRAW_REASONS" :key="r" :label="r">{{ r }}</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="withdrawForm.reason === '其他原因'" label="补充说明" required>
            <el-input v-model="withdrawForm.note" type="textarea" :rows="2" maxlength="100" show-word-limit
              placeholder="请填写退出日间手术的具体原因" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="withdrawDlg = false">取消</el-button>
        <el-button type="danger" @click="doWithdraw">确认退出并结算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DocumentAdd, Download, Search, RefreshLeft, Warning } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { state } from '@/store/db'
import { ACTION_LABEL } from '@/utils/audit'
import { statCards, activeSchedule, patchPatient, accountOf } from '@/store/patients'
import { canSchedule, evalSummary } from '@/utils/guard'
import { WITHDRAW_REASONS, PATIENT_STATUS, ACCOUNT_STATUS } from '@/mock/dict'
import { can } from '@/store/session'
import { log, query } from '@/store/logs'
import { withdraw } from '@/store/accounts'

const router = useRouter()
const tab = ref('unplanned')
const statBy = ref('科室')
const stats = computed(() => statCards())

// 今日排台 + 最近操作（首页下半屏）
const SCH_STATUS = { SCHEDULED: { label: '已预约', type: 'primary' }, CHANGED: { label: '已变更', type: 'warning' }, CHECKED_IN: { label: '已报到', type: 'success' }, DONE: { label: '已完成', type: 'info' }, CANCELLED: { label: '已取消', type: 'info' } }
const todayBoard = computed(() =>
  state.schedules
    .filter((s) => s.surgeryDate === dayjs().format('YYYY-MM-DD') && s.status !== 'CANCELLED')
    .slice()
    .sort((a, b) => a.seq - b.seq)
)
const recentLogs = computed(() => query({}).slice(0, 6))
const pname = (id) => state.patients.find((p) => p.patientId === id)?.name || '—'
const pno = (id) => state.patients.find((p) => p.patientId === id)?.inpatientNo || ''

const filters = reactive({ keyword: '', account: '', evalStatus: '', range: [] })
const withdrawDlg = ref(false)
const withdrawTarget = ref(null)
const withdrawForm = reactive({ reason: '', note: '' })

const counts = computed(() => ({
  unplanned: state.patients.filter((p) => p.status === 'DAY_SURGERY' && !activeSchedule(p.patientId)).length,
  scheduled: state.patients.filter((p) => ['SCHEDULED', 'ADMITTED'].includes(p.status)).length,
  done: state.patients.filter((p) => ['IN_SURGERY', 'DISCHARGED', 'TRANSFERRED'].includes(p.status)).length
}))

const emptyText = computed(() => tab.value === 'unplanned' ? '暂无未安排手术的患者'
  : tab.value === 'scheduled' ? '暂无已安排手术的患者' : '暂无已完成手术的患者')

const baseRows = computed(() => {
  let list = state.patients
  if (tab.value === 'unplanned') list = list.filter((p) => p.status === 'DAY_SURGERY' && !activeSchedule(p.patientId))
  if (tab.value === 'scheduled') list = list.filter((p) => ['SCHEDULED', 'ADMITTED'].includes(p.status))
  if (tab.value === 'done') list = list.filter((p) => ['IN_SURGERY', 'DISCHARGED', 'TRANSFERRED'].includes(p.status))
  return list.map((p) => ({ ...p }))
})

const rows = computed(() => baseRows.value.filter((p) => {
  const kw = filters.keyword.trim()
  if (kw && !(p.name.includes(kw) || p.inpatientNo.includes(kw) || (p.bedNo || '').includes(kw))) return false
  if (filters.account) {
    const a = accountOf(p.patientId)
    if (!a || a.status !== filters.account) return false
  }
  if (filters.evalStatus) {
    const e = evalSummary(p)
    const map = { PENDING: '待评估', PASSED: '评估通过', FAILED: '评估不通过' }
    if (e.label !== map[filters.evalStatus]) return false
  }
  if (filters.range && filters.range.length === 2) {
    const d = p.plannedSurgeryDate || ''
    if (d < filters.range[0] || d > filters.range[1]) return false
  }
  return true
}))

const report = computed(() => {
  const month = dayjs().format('YYYY-MM')
  const sc = state.schedules
  const inMonth = sc.filter((s) => s.surgeryDate.startsWith(month) && s.status !== 'CANCELLED')
  const anes = {}
  inMonth.forEach((s) => { anes[s.anesthesiaType] = (anes[s.anesthesiaType] || 0) + 1 })
  return {
    month: inMonth.length,
    done: state.patients.filter((p) => p.status === 'DISCHARGED').length + inMonth.filter((s) => s.status === 'COMPLETED').length,
    cancelled: sc.filter((s) => s.status === 'CANCELLED').length,
    discharged: state.patients.filter((p) => p.status === 'DISCHARGED').length,
    transferred: state.patients.filter((p) => p.status === 'TRANSFERRED').length,
    withdrawn: state.patients.filter((p) => p.status === 'WITHDRAWN').length,
    anes: Object.keys(anes).length ? anes : { 全身麻醉: 0 }
  }
})

// 按科室 / 医生 / 护士三个维度统计（招标 15-1）
const statRows = computed(() => {
  const month = dayjs().format('YYYY-MM')
  const map = new Map()
  const row = (name) => {
    if (!map.has(name)) map.set(name, { name, count: 0, transfer: 0, withdraw: 0 })
    return map.get(name)
  }
  const keyOfPatient = (p) => {
    if (!p) return '未指定'
    if (statBy.value === '医生') return p.surgeon || '未指定'
    if (statBy.value === '护士') return p.nurse || '未指定'
    return p.dept || '未指定'
  }
  // 转住院 / 退出按患者归属维度计
  state.patients.forEach((p) => {
    const r = row(keyOfPatient(p))
    if (p.status === 'TRANSFERRED') r.transfer += 1
    if (p.status === 'WITHDRAWN') r.withdraw += 1
  })
  // 台数按手术日期归属当月，已取消不计入
  state.schedules
    .filter((s) => s.surgeryDate.startsWith(month) && s.status !== 'CANCELLED')
    .forEach((s) => {
      const p = state.patients.find((x) => x.patientId === s.patientId)
      const key = statBy.value === '医生' ? (s.surgeon || '未指定') : keyOfPatient(p)
      row(key).count += 1
    })
  return [...map.values()]
    .filter((r) => r.count + r.transfer + r.withdraw > 0)
    .sort((a, b) => b.count - a.count || b.transfer - a.transfer)
})

const scheduleOf = (pid) => activeSchedule(pid)
const evalOf = (p) => evalSummary(p)
const accTag = (p) => ACCOUNT_STATUS[accountOf(p.patientId)?.status]?.type || 'info'
const accLabel = (p) => ACCOUNT_STATUS[accountOf(p.patientId)?.status]?.label || '—'

function go(path) { router.push(path) }

function editBed(row) {
  row._bedEditing = true
  row._bed = row.bedNo || ''
}
function saveBed(row) {
  row._bedEditing = false
  const val = (row._bed || '').trim()
  if (val === (row.bedNo || '')) return
  try {
    patchPatient(row.patientId, { bedNo: val }, '维护患者床位')
    ElMessage.success(`床位已更新为 ${val || '空床'}`)
  } catch (e) { ElMessage.error(e.message) }
}

function openWithdraw(row) {
  withdrawTarget.value = row
  withdrawForm.reason = row.evalFailReason ? '评估不通过' : ''
  withdrawForm.note = row.evalFailReason || ''
  withdrawDlg.value = true
}

function doWithdraw() {
  if (!withdrawForm.reason) return ElMessage.warning('请选择退出原因')
  if (withdrawForm.reason === '其他原因' && !withdrawForm.note) return ElMessage.warning('选择「其他原因」时必须填写补充说明')
  try {
    const list = withdraw(withdrawTarget.value.patientId, withdrawForm.reason, withdrawForm.note)
    withdrawDlg.value = false
    const refund = list.reduce((s, x) => s + x.refund, 0)
    ElMessage.success(`已退出日间手术，生成 ${list.length} 张分单结算单，退回 ¥${refund.toFixed(2)}`)
  } catch (e) { ElMessage.error(e.message) }
}

function resetFilters() {
  filters.keyword = ''
  filters.account = ''
  filters.evalStatus = ''
  filters.range = []
}

function onExport() {
  ElMessage.success(`已导出当前列表，共 ${rows.value.length} 条（演示环境不生成文件）`)
  log({
    module: 'BAS', page: '工作台', action: 'EXPORT', targetType: '患者列表',
    targetId: 'WORKBENCH', targetName: `手术患者列表（${rows.value.length} 条）`,
    reason: '导出当前筛选结果'
  })
}

const vFocus = { mounted: (el) => el.focus() }
</script>
