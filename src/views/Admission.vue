<template>
  <div>
    <div class="source-bar">
      <span class="flex gap6"><span class="dot"></span>演示数据源 · 本地模拟 HIS</span>
      <span class="tiny">只读，不回写</span>
      <div class="right">
        <span class="tiny">最近读取：{{ lastRead || '—' }}</span>
        <el-button size="small" text :icon="Refresh" @click="read(lastNo, true)">重新读取</el-button>
      </div>
    </div>

    <div class="cols" style="grid-template-columns:320px 1fr">
      <!-- 左：查询区 -->
      <div class="card" style="align-self:start">
        <div class="card-head"><div class="card-title">调入住院证</div></div>
        <el-input v-model="inpatientNo" placeholder="请输入住院号或刷就诊卡" clearable size="large"
          @keyup.enter="read(inpatientNo)">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div class="flex gap8 mt12">
          <el-button type="primary" :loading="loading" style="flex:1" @click="read(inpatientNo)">从 HIS 读取</el-button>
          <el-button :icon="Postcard" @click="mockCard">模拟刷就诊卡</el-button>
        </div>
        <div class="tiny mt12" style="line-height:1.95">
          <div>可办理入院：<b class="mono">D2026003</b> 已冻结 ¥8,000.00</div>
          <div>已入院：<b class="mono">D2026004</b> 验证撤销入口</div>
          <div>未建档：<b class="mono">D2026999</b> 验证失败提示</div>
          <div style="color:#8a5a1f">本页只调已建档患者，不产生新患者。</div>
        </div>

        <div class="divider-h"></div>
        <div class="tiny">入院办理前置条件</div>
        <div class="mt8">
          <div v-for="c in preList" :key="c.key" class="flex gap6" style="font-size:12px;margin-bottom:6px">
            <el-icon :color="c.ok ? '#2f855a' : '#c53030'"><component :is="c.ok ? 'CircleCheck' : 'CircleClose'" /></el-icon>
            <span :style="{ color: c.ok ? '#2f6750' : '#c53030' }">{{ c.label }}</span>
          </div>
        </div>
      </div>

      <!-- 右：信息区 -->
      <div>
        <div v-if="!archive" class="card">
          <div class="empty" style="padding:80px 0">
            <div class="big">⇢</div>
            请先读取 HIS 患者信息
            <div class="tiny mt8">输入住院号后点击「从 HIS 读取」，系统将带入患者主数据、住院证、检查报告与储值金</div>
          </div>
        </div>

        <template v-else>
          <div v-if="alreadyAdmitted" class="notice-bar warn">
            <el-icon><Warning /></el-icon>
            该患者已完成入院登记（{{ patient.admissionInfo?.admittedAt?.slice(0, 16) }}），确认按钮已禁用；如需变更请使用「修改登记信息」或「撤销入院登记」。
          </div>

          <div class="card">
            <div class="section-h">患者基本信息 <span class="src">来源：HIS 患者主数据</span></div>
            <div class="cols c3" style="gap:10px">
              <div class="his-field"><div class="k">姓名 <span class="his-tag">HIS</span></div><div class="v">{{ archive.patient.name }}</div></div>
              <div class="his-field"><div class="k">性别 / 年龄 <span class="his-tag">HIS</span></div><div class="v">{{ archive.patient.gender }} / {{ archive.patient.age }} 岁</div></div>
              <div class="his-field"><div class="k">住院号 <span class="his-tag">HIS</span></div><div class="v mono">{{ archive.patient.inpatientNo }}</div></div>
              <div class="his-field"><div class="k">身份证号 <span class="his-tag">HIS</span></div><div class="v mono">{{ archive.patient.idCard }}</div></div>
              <div class="his-field"><div class="k">联系电话 <span class="his-tag">HIS</span></div><div class="v mono">{{ archive.patient.phone }}</div></div>
              <div class="his-field"><div class="k">科室 <span class="his-tag">HIS</span></div><div class="v">{{ archive.patient.dept }}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="section-h">日间手术住院证 <span class="src">来源：HIS 住院证</span></div>
            <div class="cols c3" style="gap:10px">
              <div class="his-field"><div class="k">住院证号 <span class="his-tag">HIS</span></div><div class="v mono">{{ archive.admissionCert.admissionCertNo }}</div></div>
              <div class="his-field"><div class="k">诊断 <span class="his-tag">HIS</span></div><div class="v">{{ archive.admissionCert.diagnosis }}</div></div>
              <div class="his-field"><div class="k">手术名称 <span class="his-tag">HIS</span></div><div class="v">{{ archive.admissionCert.surgeryName }}</div></div>
              <div class="his-field"><div class="k">拟手术日 <span class="his-tag">HIS</span></div><div class="v num">{{ archive.admissionCert.plannedSurgeryDate }}</div></div>
              <div class="his-field"><div class="k">主刀医师 <span class="his-tag">HIS</span></div><div class="v">{{ archive.admissionCert.surgeon }}</div></div>
              <div class="his-field"><div class="k">申请单号 <span class="his-tag">HIS</span></div><div class="v mono">{{ applyNo }}</div></div>
            </div>
          </div>

          <div class="cols c2-64">
            <div class="card">
              <div class="section-h">检查检验报告 <span class="src">来源：LIS / PACS（模拟）</span></div>
              <div class="flex gap8" style="flex-wrap:wrap">
                <div v-for="r in archive.reports" :key="r.reportName"
                  class="report-chip" @click="openReport(r)">
                  <div>
                    <div style="font-size:12.5px;font-weight:600">{{ r.reportName }}</div>
                    <div class="tiny">{{ (r.reportTime || '').slice(0, 10) }} · {{ r.source }}</div>
                  </div>
                  <el-button link type="primary" size="small">查看报告</el-button>
                </div>
                <div v-if="!archive.reports.length" class="muted">暂无已出报告</div>
              </div>
              <div class="tiny mt12">共 {{ archive.reports.length }} 份报告，报告内容由医技系统出具，本系统只读展示。</div>
            </div>

            <div class="card">
              <div class="section-h">专项储值金转入 <span class="src">来源：本系统储值金账户</span></div>
              <div class="money-grid" style="grid-template-columns:1fr 1fr">
                <div class="money-card orange" style="padding:10px 12px">
                  <div class="k">转入金额</div>
                  <div class="v" style="font-size:18px">¥{{ fmtAmount(account?.frozen || account?.inpatientDeposit || 0) }}</div>
                </div>
                <div class="money-card" style="padding:10px 12px">
                  <div class="k">账户状态</div>
                  <div class="v" style="font-size:15px;margin-top:10px">
                    <el-tag :type="accTag" effect="light">{{ accLabel }}</el-tag>
                  </div>
                </div>
              </div>
              <div class="tiny mt8">入院登记确认后，冻结金额转入住院储值金。</div>
            </div>
          </div>

          <div class="card">
            <div class="section-h">本次登记信息 <span class="src">本系统填写</span></div>
            <div class="cols c3" style="gap:10px">
              <div><div class="tiny">床位</div><div style="margin-top:4px">{{ patient?.bedNo || '待分配' }}</div></div>
              <div><div class="tiny">陪护人</div><div style="margin-top:4px">{{ patient?.admissionInfo?.guardian || '—' }}</div></div>
              <div><div class="tiny">陪护电话</div><div style="margin-top:4px">{{ patient?.admissionInfo?.guardianPhone || '—' }}</div></div>
            </div>
            <div class="flex gap8 mt12" style="justify-content:flex-end">
              <el-button @click="reset">取消</el-button>
              <el-button v-if="!alreadyAdmitted" type="primary" :disabled="!canAdmit" @click="doAdmit">确认入院登记</el-button>
              <template v-else>
                <el-button @click="editDlg = true">修改登记信息</el-button>
                <el-button type="danger" plain @click="doCancelAdmission">撤销入院登记</el-button>
              </template>
            </div>
            <div v-if="!alreadyAdmitted && !canAdmit" class="tiny mt8 right" style="color:#c53030">
              {{ blockReason }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <ReportDrawer v-model="reportDlg" :report="report" />

    <el-drawer v-model="editDlg" title="修改入院登记信息" size="420px">
      <div class="notice-bar"><el-icon><Lock /></el-icon>HIS 带入字段不可修改，仅可变更床位、陪护信息与备注。</div>
      <el-form label-width="88px">
        <el-form-item label="床位">
          <el-select v-model="editForm.bedNo" style="width:100%">
            <el-option v-for="b in beds" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="陪护人"><el-input v-model="editForm.guardian" /></el-form-item>
        <el-form-item label="陪护电话"><el-input v-model="editForm.guardianPhone" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.note" type="textarea" :rows="3" maxlength="200" show-word-limit /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDlg = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Postcard, Refresh, Warning } from '@element-plus/icons-vue'
import { fetchPatientArchive } from '@/api/his'
import { fmtAmount } from '@/utils/format'
import { get as getPatient } from '@/store/patients'
import { accountOf, transferIn } from '@/store/accounts'
import { goStatus } from '@/utils/guard'
import { state, persist } from '@/store/db'
import { log } from '@/store/logs'
import { PATIENT_STATUS } from '@/mock/dict'
import { fmtClock } from '@/utils/format'
import ReportDrawer from '@/components/ReportDrawer.vue'

const route = useRoute()
const router = useRouter()
const beds = ['日间 01 床', '日间 02 床', '日间 03 床', '日间 05 床', '日间 06 床']

const inpatientNo = ref('')
const lastNo = ref('')
const archive = ref(null)
const loading = ref(false)
const lastRead = ref('')
const reportDlg = ref(false)
const report = ref(null)
const editDlg = ref(false)
const editForm = reactive({ bedNo: '', guardian: '', guardianPhone: '', note: '' })

const patient = computed(() => (archive.value ? getPatient(archive.value.patient.patientId) : null))
const account = computed(() => (patient.value ? accountOf(patient.value.patientId) : null))
const alreadyAdmitted = computed(() => !!patient.value?.admissionInfo)
const applyNo = computed(() => state.applies.find((a) => a.patientId === patient.value?.patientId)?.applyNo || '—')

const accLabel = computed(() => accStoreLabel(account.value?.status))
function accStoreLabel(s) {
  return { NORMAL: '正常（未冻结）', FROZEN: '已冻结', TRANSFERRED_IN: '已转入住院', SETTLED: '已结算' }[s] || '未开户'
}
const accTag = computed(() => ({ NORMAL: 'info', FROZEN: 'warning', TRANSFERRED_IN: 'success', SETTLED: 'info' }[account.value?.status] || 'info'))

const canAdmit = computed(() => {
  if (!patient.value || alreadyAdmitted.value) return false
  if (patient.value.status !== 'SCHEDULED') return false
  return !!account.value && ['FROZEN', 'TRANSFERRED_IN'].includes(account.value.status)
})

// 不满足条件时给出「具体是哪一条不满足」，避免一句笼统提示
const blockReason = computed(() => {
  const p = patient.value
  const a = account.value
  if (!p) return '该住院号尚未在本系统建档，不能办理入院登记。'
  if (p.status !== 'SCHEDULED') {
    return `该患者当前状态为「${PATIENT_STATUS[p.status]?.label || p.status}」，需先完成术前评估与手术排程才能办理入院登记。`
  }
  if (!a) return '该患者尚未开立储值金账户，请先到「储值金管理」办理缴存与冻结。'
  if (!['FROZEN', 'TRANSFERRED_IN'].includes(a.status)) {
    return `储值金账户当前状态为「${accLabel.value}」，请先完成术前检查费用冻结。`
  }
  return ''
})

const preList = computed(() => {
  const p = patient.value
  const a = account.value
  return [
    { key: 'archived', ok: !!p, label: '住院号已在本系统建档' },
    { key: 'scheduled', ok: p?.status === 'SCHEDULED', label: '已完成手术排程（状态：已排程）' },
    { key: 'money', ok: !!a && ['FROZEN', 'TRANSFERRED_IN'].includes(a.status), label: '储值金已冻结或已转入住院' },
    { key: 'cert', ok: !!archive.value?.admissionCert, label: 'HIS 住院证已调入' }
  ]
})

async function read(no, force) {
  const num = (no || '').trim()
  if (!num) return ElMessage.warning('请输入住院号')
  loading.value = true
  try {
    const res = await fetchPatientArchive(num)
    archive.value = res
    lastNo.value = num
    lastRead.value = fmtClock(new Date())
    ElMessage.success('已从 HIS 读取患者信息')
  } catch (e) {
    if (force) {
      archive.value = null
    }
    ElMessage.error(e.message)
    archive.value = null
  } finally {
    loading.value = false
  }
}

function mockCard() {
  const target = state.patients.find((p) => p.status === 'SCHEDULED' && !p.admissionInfo) || state.patients[0]
  inpatientNo.value = target.inpatientNo
  read(target.inpatientNo)
}

function openReport(r) {
  report.value = { ...r, reportName: r.reportName }
  reportDlg.value = true
}

function doAdmit() {
  if (!canAdmit.value) return
  const p = patient.value
  ElMessageBox.confirm(
    `确认患者${p.name}（${p.inpatientNo}）办理入院登记？确认后储值金转入住院储值金，患者状态变更为「已入院」。`,
    '确认入院登记', { type: 'info', confirmButtonText: '确认登记', cancelButtonText: '取消' }
  ).then(() => {
    try {
      if (account.value?.status === 'FROZEN') transferIn(p.patientId)
      const bed = beds[2]
      const before = { 患者状态: '已排程' }
      goStatus(p, 'ADMITTED', { by: state.session.name })
      p.bedNo = bed
      p.admissionInfo = {
        admissionCertNo: p.admissionCertNo, bedNo: bed, admittedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        guardian: '', guardianPhone: '', note: '', operator: state.session.name
      }
      log({
        module: 'ADM', page: '入院登记', action: 'STATUS', targetType: '入院登记单',
        targetId: p.admissionCertNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
        before, after: { 患者状态: '已入院', 床位: bed, 储值金: `转入住院 ¥${fmtAmount(account.value.inpatientDeposit)}` },
        reason: '调入 HIS 住院证办理入院登记'
      })
      persist()
      ElMessage.success('入院登记成功，可继续办理手术费用')
      setTimeout(() => router.push('/charge/' + p.patientId), 600)
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function reset() {
  archive.value = null
  inpatientNo.value = ''
}

watch(editDlg, (v) => {
  if (v && patient.value) {
    const a = patient.value.admissionInfo || {}
    Object.assign(editForm, {
      bedNo: a.bedNo || patient.value.bedNo || beds[2],
      guardian: a.guardian || '', guardianPhone: a.guardianPhone || '', note: a.note || ''
    })
  }
})

function saveEdit() {
  const p = patient.value
  const before = { ...p.admissionInfo }
  p.admissionInfo = { ...p.admissionInfo, ...editForm }
  p.bedNo = editForm.bedNo
  log({
    module: 'ADM', page: '入院登记 › 修改', action: 'UPDATE', targetType: '入院登记单',
    targetId: p.admissionCertNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
    before, after: { ...p.admissionInfo }, reason: '修改床位与陪护信息'
  })
  persist()
  editDlg.value = false
  ElMessage.success('入院登记信息已更新')
}

function doCancelAdmission() {
  const p = patient.value
  const hasCharge = state.charges.some((c) => c.patientId === p.patientId && c.status !== 'VOIDED')
  const today = new Date().toISOString().slice(0, 10)
  if (hasCharge || (p.admissionInfo?.admittedAt || '').slice(0, 10) !== today) {
    ElMessage.error('已产生费用，不能撤销入院登记；如需退回，请先作废费用单')
    log({
      module: 'ADM', page: '入院登记', action: 'CANCEL', targetType: '入院登记单',
      targetId: p.admissionCertNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
      result: 'FAIL', failReason: '已产生费用或非当日登记，超出撤销窗口', reason: '撤销入院登记'
    })
    return
  }
  ElMessageBox.prompt('撤销入院登记需填写原因，撤销后床位释放，患者回到「已排程」。', '撤销入院登记', {
    inputPlaceholder: '如：患者临时改期',
    inputValidator: (v) => (v && v.trim() ? true : '请填写撤销原因'),
    confirmButtonText: '确认撤销'
  }).then(({ value }) => {
    const before = { 患者状态: '已入院', 床位: p.bedNo }
    p.admissionInfo = null
    p.bedNo = ''
    goStatus(p, 'SCHEDULED', { by: state.session.name })
    log({
      module: 'ADM', page: '入院登记', action: 'CANCEL', targetType: '入院登记单',
      targetId: p.admissionCertNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
      before, after: { 患者状态: '已排程', 床位: '已释放' }, reason: value
    })
    persist()
    archive.value = null
    ElMessage.success('入院登记已撤销，床位已释放')
  }).catch(() => {})
}

const queryId = route.params.patientId
if (queryId) {
  const p = getPatient(queryId)
  if (p) {
    inpatientNo.value = p.inpatientNo
    read(p.inpatientNo)
  }
}
</script>

<style scoped>
.his-field {
  background: #f5f7fa; border: 1px solid #e8edf4; border-radius: 6px; padding: 8px 10px;
}
.his-field .k { font-size: 11.5px; color: #8a94a6; display: flex; align-items: center; }
.his-field .v { font-size: 12.5px; color: #2b3546; margin-top: 3px; font-weight: 600; }
.report-chip {
  display: flex; align-items: center; gap: 14px; border: 1px solid var(--line); border-radius: 6px;
  padding: 7px 10px; cursor: pointer; background: #fff; min-width: 168px;
}
.report-chip:hover { border-color: #b9d3ec; background: #f8fbff; }
</style>
