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
        </div>

        <div class="divider-h"></div>
        <div class="tiny">刷卡报到 · 招标第 11 项：刷医保卡 / 就诊卡 / 身份证</div>
        <div class="mt8">
          <el-select v-model="cardType" size="large" style="width:100%">
            <el-option v-for="c in CARD_READ_TYPES" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
          <el-input v-model="cardNo" class="mt8" size="large" clearable
            :placeholder="'请输入' + cardTypeOf(cardType).noLabel">
            <template #prefix><el-icon><Postcard /></el-icon></template>
          </el-input>
        </div>
        <el-button class="mt8" style="width:100%" :icon="Postcard" :loading="cardReading" @click="readByCard">
          刷卡报到
        </el-button>
        <div class="tiny mt8">卡号留空直接点「刷卡报到」，由读卡器模拟刷出今日待报到患者的卡片。</div>

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
            请输入住院号、扫描申请单条码或刷卡报到
            <div class="tiny mt8">演示可点左侧「模拟扫码」或选择刷卡方式后点「刷卡报到」自动带出今日待报到患者</div>
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
              <div v-else-if="patient.status !== 'ADMITTED'" class="notice-bar warn mt12">
                <el-icon><Warning /></el-icon>
                该患者当前状态为「{{ PATIENT_STATUS[patient.status]?.label || patient.status }}」，尚未办理入院登记，须先到「入院登记」调入住院证后才能报到。
                <el-button link type="primary" size="small" @click="router.push('/admission/' + pid)">去入院登记</el-button>
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

    <el-dialog v-model="historyDlg" title="既往报到记录" width="790px">
      <div v-if="history.length" class="notice-bar">
        <el-icon><InfoFilled /></el-icon>
        共 {{ history.length }} 条报到记录，报到后不可修改；如需撤回请使用「取消报到」，记录保留并标记为已取消。
      </div>
      <el-table :data="history" size="small" border>
        <el-table-column prop="checkInId" label="报到号" width="104">
          <template #default="{ row }"><span class="mono">{{ row.checkInId }}</span></template>
        </el-table-column>
        <el-table-column label="报到时间" width="150">
          <template #default="{ row }"><span class="num">{{ (row.checkInTime || '').slice(0, 16) }}</span></template>
        </el-table-column>
        <el-table-column prop="checkInMethod" label="报到方式" width="140" />
        <el-table-column prop="checkInBy" label="操作员" width="80" />
        <el-table-column label="知情同意书" width="106" align="center">
          <template #default="{ row }">
            <span :class="row.printConsent ? '' : 'muted'">{{ row.printConsent ? '已打印' : '未打印' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.voided ? 'info' : 'success'">{{ row.voided ? '已取消' : '有效' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="取消原因" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.voidReason || '—' }}</template>
        </el-table-column>
        <template #empty><div class="empty">暂无数据</div></template>
      </el-table>
    </el-dialog>

    <!-- 手术知情同意书 · 套打模板预览 -->
    <el-dialog v-model="consentDlg" title="手术知情同意书（套打模板预览）" width="780px" top="4vh">
      <div class="notice-bar" style="margin-bottom:10px">
        <el-icon><InfoFilled /></el-icon>
        套打说明：空白单据已预印表头、栏目线与同意条款，打印机仅在填写区套打患者与手术信息；下页为打印效果预览。
      </div>
      <div class="consent-paper">
        <div class="cp-head">
          <div class="cp-hospital">{{ HOSPITAL_NAME }}</div>
          <div class="cp-title">日间手术知情同意书</div>
          <div class="cp-code">单据编号：ZRT-2024-CONS-03（套打版）</div>
        </div>
        <div class="cp-grid">
          <span class="k">患者姓名</span><span class="fill w72">{{ patient?.name }}</span>
          <span class="k">性别</span><span class="fill w40">{{ patient?.gender }}</span>
          <span class="k">年龄</span><span class="fill w40">{{ patient?.age }} 岁</span>
          <span class="k">住院号</span><span class="fill w96 mono">{{ patient?.inpatientNo }}</span>
          <span class="k">科别</span><span class="fill w72">{{ patient?.dept }}</span>
          <span class="k">床位</span><span class="fill w72">{{ patient?.bedNo || '未分配' }}</span>
        </div>
        <div class="cp-row">
          <span class="k">术前诊断</span><span class="fill flex1">{{ patient?.diagnosis }}</span>
        </div>
        <div class="cp-row">
          <span class="k">拟施手术</span><span class="fill flex1">{{ patient?.surgeryName }}（{{ patient?.surgeryCode }}）</span>
        </div>
        <div class="cp-grid">
          <span class="k">手术医师</span><span class="fill w72">{{ schedule?.surgeon || patient?.surgeon }}</span>
          <span class="k">麻醉方式</span><span class="fill w96">{{ schedule?.anesthesiaType || '—' }}</span>
          <span class="k">麻醉医师</span><span class="fill w72">{{ schedule?.anesthesiologist || '—' }}</span>
          <span class="k">手术日期</span><span class="fill w96 num">{{ schedule?.surgeryDate || patient?.plannedSurgeryDate }}</span>
          <span class="k">手术间</span><span class="fill w72">{{ schedule?.room || patient?.surgeryRoom || '—' }}</span>
          <span class="k">台次</span><span class="fill w40">{{ schedule?.seq ? '第 ' + schedule.seq + ' 台' : '—' }}</span>
        </div>
        <div class="cp-terms">
          <div class="cp-terms-h">知情同意条款（预印，不参与套打）</div>
          <ol>
            <li>我已了解日间手术「入院、手术、出院 24—48 小时内完成」的模式及出院标准。</li>
            <li>我理解麻醉意外、术中出血、周围组织损伤等手术风险，并同意实施上述麻醉与手术。</li>
            <li>我同意术后按医嘱离院，出现发热、剧痛、出血等异常时立即返回医院急诊。</li>
            <li>我授权医师在术中出现意外情况时，根据病情变更手术方式或中转普通住院治疗。</li>
            <li>我已知晓手术费用从专项储值金中记账结算，多退少补。</li>
            <li>本同意书一式两份，医患双方各执一份，自签字之日起生效。</li>
          </ol>
        </div>
        <div class="cp-sign">
          <div>患者签名：<span class="line"></span>　　与患者关系：<span class="line short"></span></div>
          <div>谈话医师签名：<span class="line"></span>　　日期：<span class="line short"></span> 年 <span class="line xs"></span> 月 <span class="line xs"></span> 日</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="consentDlg = false">关闭预览</el-button>
        <el-button type="primary" :icon="Printer" @click="confirmPrint">确认打印</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Document, Printer, InfoFilled, Postcard, Warning } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { get as getPatient } from '@/store/patients'
import { preCheck, doCheckIn as checkInStore, cancelCheckIn, todaySchedules, CHECKIN_METHODS } from '@/store/checkins'
import { PATIENT_STATUS, CARD_READ_TYPES, cardTypeOf, cardNoOf } from '@/mock/dict'
import { fetchExamReports, fetchPatientByCard } from '@/api/his'
import { log } from '@/store/logs'
import ExamList from '@/components/ExamList.vue'
import ReportDrawer from '@/components/ReportDrawer.vue'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const pid = ref(route.query.patient || '')
// 报到方式：扫码 / 刷卡 / 手工输入，写入报到记录并可回溯
const checkInMethod = ref(CHECKIN_METHODS.MANUAL)
// 刷卡方式：招标第 11 项，刷医保卡 / 就诊卡 / 身份证
const cardType = ref('MEDICAL_CARD')
const cardNo = ref('')
const cardReading = ref(false)
const reportDlg = ref(false)
const oneDlg = ref(false)
const oneReport = ref(null)
const historyDlg = ref(false)
const consentDlg = ref(false)
const exams = ref([])

// 套打模板抬头（与顶栏医院名一致）
const HOSPITAL_NAME = '四川省骨科医院'

// 换卡种要换卡号：已读到的卡号属于上一种证件，留着会误导护士
watch(cardType, () => { cardNo.value = '' })

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
  checkInMethod.value = CHECKIN_METHODS.MANUAL
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
  checkInMethod.value = CHECKIN_METHODS.SCAN
  pid.value = p.patientId
  loadExams(p.patientId)
  ElMessage.success(`已扫描申请单条码：${p.name} ${p.inpatientNo}`)
}

/**
 * 刷卡报到：招标第 11 项「刷医保卡 / 就诊卡 / 身份证」
 * 卡号留空时由读卡器模拟刷出今日待报到患者的卡片；填卡号则按该证件号定位患者。
 */
async function readByCard() {
  const t = cardTypeOf(cardType.value)
  let no = cardNo.value.trim()
  if (!no) {
    const s = pickToday()
    if (!s) return ElMessage.warning('今日没有待报到患者')
    no = cardNoOf(getPatient(s.patientId), t.value)
    if (!no) return ElMessage.warning(`未取到该患者的${t.noLabel}，请手动输入后再刷卡`)
  }
  cardReading.value = true
  try {
    const res = await fetchPatientByCard(t.value, no)
    const p = getPatient(res.patient.patientId)
    if (!p) return ElMessage.error('该患者尚未在本系统建档，不能报到')
    cardNo.value = res.cardNo
    keyword.value = p.inpatientNo
    checkInMethod.value = CHECKIN_METHODS[t.value]
    pid.value = p.patientId
    loadExams(p.patientId)
    ElMessage.success(`已读取${t.label}（${res.cardNo}）：${p.name} ${p.inpatientNo}`)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    cardReading.value = false
  }
}

function pick(s) {
  const p = getPatient(s.patientId)
  keyword.value = p.inpatientNo
  checkInMethod.value = CHECKIN_METHODS.MANUAL
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

/** 打印手术知情同意书：先打开套打模板预览，确认后再发送打印队列 */
function printConsent() {
  consentDlg.value = true
}

function confirmPrint() {
  ElMessage.success('手术知情同意书已按套打模板发送至打印队列（演示环境不输出纸质件）')
  consentDlg.value = false
  log({
    module: 'CIR', page: '手术报到', action: 'EXPORT', targetType: '手术知情同意书',
    targetId: patient.value.inpatientNo, targetName: `${patient.value.name} 手术知情同意书（套打模板）`,
    patientId: patient.value.patientId, reason: '报到时按套打模板打印手术知情同意书'
  })
}

function openHistory() {
  historyDlg.value = true
}

function doCheckIn() {
  if (!allOk.value) return ElMessage.error('报到条件不满足，不能报到')
  ElMessageBox.confirm(
    `确认患者${patient.value.name}（${patient.value.inpatientNo}）报到？报到方式：${checkInMethod.value}。报到后状态变更为术中，不可撤销；如需撤回请使用「取消报到」。`,
    '确认报到', { type: 'warning', confirmButtonText: '确认报到', cancelButtonText: '取消' }
  ).then(() => {
    try {
      checkInStore(patient.value.patientId, checkInMethod.value)
      ElMessage.success('报到成功，患者状态已变更为「术中」，报到记录已留痕')
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

/* ---- 手术知情同意书套打预览 ---- */
.consent-paper {
  border: 1px solid #c9d2e0; border-radius: 4px; padding: 18px 22px;
  background: #fff; color: #1f2d3d; font-size: 13px; line-height: 1.9;
  box-shadow: 0 2px 8px rgba(31, 45, 61, .06);
}
.cp-head { text-align: center; border-bottom: 2px solid #1f2d3d; padding-bottom: 8px; }
.cp-hospital { font-size: 16px; font-weight: 700; letter-spacing: 2px; }
.cp-title { font-size: 18px; font-weight: 700; letter-spacing: 6px; margin-top: 2px; }
.cp-code { font-size: 11px; color: #8a94a6; margin-top: 2px; }
.cp-grid, .cp-row { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 10px; align-items: baseline; }
.cp-row { display: flex; }
.cp-grid .k, .cp-row .k { color: #5b6b82; flex: none; }
.fill {
  display: inline-block; min-height: 20px; line-height: 20px; text-align: center;
  border-bottom: 1px solid #1f2d3d; padding: 0 6px; font-weight: 600;
}
.fill.w40 { width: 40px; } .fill.w72 { width: 72px; }
.fill.w96 { width: 96px; } .fill.flex1 { flex: 1; text-align: left; }
.cp-terms { margin-top: 14px; border-top: 1px dashed #9aa8bd; padding-top: 8px; }
.cp-terms-h { font-weight: 700; margin-bottom: 4px; }
.cp-terms ol { margin: 0; padding-left: 20px; font-size: 12.5px; color: #3a4a5f; }
.cp-terms li { margin-bottom: 2px; }
.cp-sign { margin-top: 16px; display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; font-size: 13px; }
.cp-sign .line { display: inline-block; width: 130px; border-bottom: 1px solid #1f2d3d; height: 16px; vertical-align: bottom; }
.cp-sign .line.short { width: 70px; }
.cp-sign .line.xs { width: 34px; }
</style>
