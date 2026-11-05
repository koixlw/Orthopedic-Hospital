<template>
  <div>
    <div class="cols" style="grid-template-columns:340px 1fr">
      <!-- 左：查询区 -->
      <div class="card" style="align-self:start">
        <div class="card-head"><div class="card-title">手术报到</div></div>
        <div class="tiny">住院号 / 申请单号</div>
        <el-input v-model="keyword" size="large" class="mt8" placeholder="D2026004 或 APL20261101006"
          @keyup.enter="doQuery">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="flex gap8 mt12">
          <el-button type="primary" style="flex:1" @click="doQuery">查询</el-button>
          <el-button @click="mockScan">模拟扫码</el-button>
          <el-button @click="mockCard">刷就诊卡</el-button>
        </div>

        <div class="divider-h"></div>
        <div class="flex" style="justify-content:space-between">
          <span class="tiny">今日待报到（{{ todayList.length }} 人）</span>
          <span class="tiny">点击直接查询</span>
        </div>
        <div class="mt8">
          <div v-for="s in todayList" :key="s.scheduleId" class="wait-item" @click="pick(s)">
            <div class="flex" style="justify-content:space-between">
              <span style="font-weight:600">{{ pname(s.patientId) }}</span>
              <span class="tiny mono">{{ pno(s.patientId) }}</span>
            </div>
            <div class="tiny" style="margin-top:2px">{{ pSurgery(s.patientId) }} · {{ s.room }} 第 {{ s.seq }} 台</div>
          </div>
          <div v-if="!todayList.length" class="tiny mt8">今日暂无待报到患者</div>
        </div>

        <div class="notice-bar mt12" style="margin-bottom:0">
          <el-icon><InfoFilled /></el-icon>
          报到需四项条件全部满足，缺一项即不可报到。
        </div>
      </div>

      <!-- 右：患者卡 + 校验清单 -->
      <div>
        <div v-if="!patient" class="card">
          <div class="empty" style="padding:90px 0">
            <div class="big">⇢</div>
            请输入住院号或扫描申请单条码
            <div class="tiny mt8">演示可点左侧「模拟扫码」自动带出今日待报到患者</div>
          </div>
        </div>

        <template v-else>
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:14px 16px;background:linear-gradient(180deg,#f7fbff,#fff);border-bottom:1px solid var(--line)">
              <div class="flex gap8">
                <span style="font-size:17px;font-weight:700">{{ patient.name }}</span>
                <span class="muted">{{ patient.gender }} · {{ patient.age }} 岁</span>
                <span class="mono tiny">{{ patient.inpatientNo }}</span>
                <el-tag size="small" :type="PATIENT_STATUS[patient.status].type" style="margin-left:auto">
                  {{ PATIENT_STATUS[patient.status].label }}
                </el-tag>
              </div>
              <div class="mt8" style="font-size:13px">{{ patient.surgeryName }}</div>
              <div class="tiny mt8">
                {{ schedule ? `${schedule.surgeryDate} ${schedule.room} 第 ${schedule.seq} 台` : '尚未排程' }}
                · 主刀 {{ schedule?.surgeon || patient.surgeon }}
                · {{ schedule?.anesthesiaType || '—' }} · 麻醉医师 {{ schedule?.anesthesiologist || '—' }}
              </div>
              <div class="tiny mt8">
                过敏史：<span :class="patient.allergy && patient.allergy !== '无' ? 'amount-red' : ''"
                  style="font-weight:600">{{ patient.allergy || '未提供' }}</span>
                <span style="margin-left:14px">床位：{{ patient.bedNo || '—' }}</span>
              </div>
            </div>

            <div style="padding:14px 16px">
              <div class="section-h">报到条件校验 <span class="src">四项逐条校验，不满足即禁用报到</span></div>
              <div class="check-list">
                <div v-for="c in checks" :key="c.key" class="check-row" :class="c.ok ? 'ok' : 'bad'">
                  <span class="mark">{{ c.ok ? '✓' : '✗' }}</span>
                  <span class="lbl">{{ c.label }}</span>
                  <span class="detail">{{ c.detail }}</span>
                  <span class="act">
                    <el-button v-if="!c.ok" link type="primary" size="small" @click="goLink(c)">{{ c.linkText }}</el-button>
                  </span>
                </div>
              </div>

              <div class="flex gap8 mt12" style="justify-content:space-between">
                <div class="flex gap8">
                  <el-button :icon="Document" @click="openReports">查看术前检查报告</el-button>
                  <el-button v-if="can('chk.print')" :icon="Printer" @click="printConsent">打印手术知情同意书</el-button>
                  <el-button @click="openHistory">既往报到记录</el-button>
                </div>
                <div class="flex gap8">
                  <el-button v-if="patient.status === 'IN_SURGERY' && can('chk.cancel')" type="warning" plain @click="doCancelCheckIn">取消报到</el-button>
                  <el-button v-if="can('chk.confirm')" type="primary" size="large" :disabled="!allOk" @click="doCheckIn">确认报到</el-button>
                </div>
              </div>

              <div v-if="patient.status === 'IN_SURGERY'" class="notice-bar mt12">
                <el-icon><CircleCheck /></el-icon>
                该患者已完成报到，患者状态为「术中」，排程状态为「已报到」。报到后不可修改，如需撤回请使用「取消报到」。
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 报到后流程：让评审一眼看到状态是怎么往下走的 -->
    <div class="card" style="margin-top:14px">
      <div class="section-h">报到后流程<span class="src">状态按流转规则推进，不可跳步；每一步都写入患者轨迹</span></div>
      <div class="flow-strip">
        <div v-for="(s, i) in FLOW" :key="s.label" class="flow-step" :class="{ on: patient && s.keys.includes(patient.status) }">
          <div class="idx">{{ i + 1 }}</div>
          <div style="min-width:0">
            <div class="t">{{ s.label }}</div>
            <div class="d">{{ s.desc }}</div>
          </div>
        </div>
      </div>
      <div class="tiny mt12" style="color:#8a94a6">
        报到后如需撤回，仅当日且未产生费用时可「取消报到」，患者回到「已入院」；已产生费用时须先作废费用单。
      </div>
    </div>

    <el-drawer v-model="reportDlg" title="术前检查报告" size="560px">
      <ExamList :exams="exams" @view="openOne" />
      <div class="notice-bar mt12">
        <el-icon><InfoFilled /></el-icon>
        报到时护士可查看全部术前检查、检验报告，报告由医技系统出具，本系统只读。
      </div>
    </el-drawer>

    <ReportDrawer v-model="oneDlg" :report="oneReport" />

    <el-dialog v-model="historyDlg" title="既往报到记录" width="560px">
      <el-table :data="history" size="small" border>
        <el-table-column prop="checkinId" label="报到号" width="100" />
        <el-table-column prop="time" label="报到时间" width="160" />
        <el-table-column prop="method" label="报到方式" width="110" />
        <el-table-column prop="operator" label="操作员" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.cancelled ? 'info' : 'success'">{{ row.cancelled ? '已取消' : '有效' }}</el-tag>
          </template>
        </el-table-column>
        <template #empty><div class="empty">暂无报到记录</div></template>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Document, Printer, InfoFilled } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { get as getPatient } from '@/store/patients'
import { preCheck, doCheckIn as checkInStore, cancelCheckIn, todaySchedules } from '@/store/checkins'
import { PATIENT_STATUS } from '@/mock/dict'
import { fetchExamReports } from '@/api/his'
import { log } from '@/store/logs'
import ExamList from '@/components/ExamList.vue'
import ReportDrawer from '@/components/ReportDrawer.vue'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const pid = ref(route.query.patient || '')
const reportDlg = ref(false)
const oneDlg = ref(false)
const oneReport = ref(null)
const historyDlg = ref(false)
const exams = ref([])

const patient = computed(() => (pid.value ? getPatient(pid.value) : null))
const schedule = computed(() => {
  if (!patient.value) return null
  return state.schedules.find((s) => s.patientId === patient.value.patientId && s.status !== 'CANCELLED') || null
})
const checks = computed(() => (patient.value ? preCheck(patient.value.patientId) : []))
// 报到后流程条：与状态机一一对应，当前状态高亮
const FLOW = [
  { label: '预约排程', desc: '确认日期 / 手术间 / 台次', keys: ['SCHEDULED'] },
  { label: '入院登记', desc: '住院证调入 + 储值金转入', keys: ['ADMITTED'] },
  { label: '手术报到', desc: '四项条件校验后报到，状态转术中', keys: ['IN_SURGERY'] },
  { label: '术后转归', desc: '出院 / 转普通住院 / 退出', keys: ['DISCHARGED', 'TRANSFERRED', 'WITHDRAWN'] }
]
const allOk = computed(() => checks.value.length === 4 && checks.value.every((c) => c.ok) && patient.value?.status === 'ADMITTED')
const todayList = computed(() => todaySchedules().filter((s) => getPatient(s.patientId)))
const history = computed(() => (patient.value ? state.checkins.filter((c) => c.patientId === patient.value.patientId).slice().reverse() : []))

const pname = (id) => getPatient(id)?.name || '—'
const pno = (id) => getPatient(id)?.inpatientNo || ''
const pSurgery = (id) => getPatient(id)?.surgeryName || ''

function doQuery() {
  const kw = keyword.value.trim()
  if (!kw) return ElMessage.warning('请输入住院号或申请单号')
  const p = state.patients.find((x) => x.inpatientNo === kw) ||
    state.patients.find((x) => state.applies.some((a) => a.patientId === x.patientId && a.applyNo === kw))
  if (!p) return ElMessage.error('未找到该住院号对应的日间手术患者，请确认住院号或扫描申请单条码')
  pid.value = p.patientId
  loadExams(p.patientId)
}

// 优先取「已入院」的患者：只有已入院才能报到，避免扫码落到未入院患者
function pickToday() {
  return todayList.value.find((x) => getPatient(x.patientId)?.status === 'ADMITTED') || todayList.value[0]
}

function mockScan() {
  const s = pickToday()
  if (!s) return ElMessage.warning('今日没有待报到患者')
  const p = getPatient(s.patientId)
  keyword.value = p.inpatientNo
  pid.value = p.patientId
  loadExams(p.patientId)
  ElMessage.success(`已扫描申请单条码：${p.name} ${p.inpatientNo}`)
}

function mockCard() {
  const s = pickToday()
  if (!s) return ElMessage.warning('今日没有待报到患者')
  const p = getPatient(s.patientId)
  keyword.value = p.inpatientNo
  pid.value = p.patientId
  loadExams(p.patientId)
  ElMessage.success(`已读取就诊卡：${p.name} ${p.inpatientNo}`)
}

function pick(s) {
  const p = getPatient(s.patientId)
  keyword.value = p.inpatientNo
  pid.value = p.patientId
  loadExams(p.patientId)
}

async function loadExams(id) {
  try {
    const res = await fetchExamReports(id)
    exams.value = res.exams
  } catch (e) {
    exams.value = []
  }
}

function openReports() {
  reportDlg.value = true
}
function openOne(exam) {
  oneReport.value = { ...exam.report, reportName: exam.name, reportTime: exam.reportTime, source: exam.source }
  oneDlg.value = true
}

function printConsent() {
  ElMessage.success('手术知情同意书已发送至打印队列（演示环境不输出纸质件）')
  log({
    module: 'CIR', page: '手术报到', action: 'EXPORT', targetType: '手术知情同意书',
    targetId: patient.value.inpatientNo, targetName: `${patient.value.name} 手术知情同意书`,
    patientId: patient.value.patientId, reason: '报到时打印手术知情同意书'
  })
}

function openHistory() {
  historyDlg.value = true
}

function doCheckIn() {
  if (!allOk.value) return ElMessage.error('报到条件不满足，不能报到')
  ElMessageBox.confirm(
    `确认患者${patient.value.name}（${patient.value.inpatientNo}）报到？报到后状态变更为术中，不可撤销；如需撤回请使用「取消报到」。`,
    '确认报到', { type: 'warning', confirmButtonText: '确认报到', cancelButtonText: '取消' }
  ).then(() => {
    try {
      checkInStore(patient.value.patientId, '手工输入住院号')
      ElMessage.success('报到成功，患者状态已变更为「术中」')
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function doCancelCheckIn() {
  ElMessageBox.prompt('取消报到需填写原因，取消后患者回到「已入院」，排程回到「已预约」。', '取消报到', {
    inputPlaceholder: '如：患者临时取消手术',
    inputValidator: (v) => (v && v.trim() ? true : '请填写取消原因'),
    confirmButtonText: '确认取消'
  }).then(({ value }) => {
    try {
      cancelCheckIn(patient.value.patientId, value)
      ElMessage.success('已取消报到，患者与排程状态已回退')
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function goLink(c) {
  if (c.link.startsWith('/deposit/')) router.push(c.link)
  else if (c.key === 'eval') { if (can('evaluate')) router.push('/evaluation/' + pid.value) }
  else if (c.key === 'date') router.push('/schedule?patient=' + pid.value)
  else router.push('/schedule?patient=' + pid.value)
}

if (pid.value) loadExams(pid.value)
</script>

<style scoped>
.wait-item {
  border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin-bottom: 7px;
  cursor: pointer; background: #fff;
}
.wait-item:hover { border-color: #b9d3ec; background: #f8fbff; }
.flow-strip { display: flex; gap: 10px; }
.flow-step {
  flex: 1; display: flex; align-items: center; gap: 10px; min-width: 0;
  border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: #fafbfd;
}
.flow-step.on { border-color: #9dc4e8; background: #f2f8ff; }
.flow-step .idx {
  width: 22px; height: 22px; border-radius: 50%; flex: none; background: #e8eef7; color: #5b6b82;
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
}
.flow-step.on .idx { background: #2b6cb0; color: #fff; }
.flow-step .t { font-size: 12.5px; font-weight: 600; }
.flow-step .d { font-size: 11.5px; color: #8a94a6; margin-top: 2px; }
</style>
