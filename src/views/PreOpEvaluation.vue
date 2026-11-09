<template>
  <div v-if="patient">
    <PatientHeader :patient="patient" :show-back="false">
      <template #actions>
        <el-tag :type="EVAL_STATUS[status].type" effect="dark">{{ EVAL_STATUS[status].label }}</el-tag>
        <el-button size="small" :icon="Back" @click="backToList">返回列表</el-button>
      </template>
    </PatientHeader>

    <div class="card">
      <div class="card-head">
        <div class="card-title">术前评估详情</div>
        <div class="card-sub">检查报告齐全 → 专科评估 → 麻醉评估，三项顺序不可颠倒；评估结论一经提交不可撤销</div>
      </div>

      <div class="cols c2-46">
        <!-- 左栏：检查项目与报告 -->
        <div>
          <div class="section-h">
            术前检查（{{ exams.length }} 项）
            <span class="src">来源：医技预约系统（模拟）</span>
          </div>
          <div class="hint-box info" style="margin-bottom:10px">
            <el-icon><InfoFilled /></el-icon>
            <div>检查预约与执行由医技系统完成，本系统同步预约状态与报告，不修改预约。</div>
          </div>
          <div class="flex" style="justify-content:space-between;margin-bottom:8px">
            <span class="muted">报告完成度</span>
            <span :class="progress.done < progress.total ? 'amount-red' : 'amount-green'" style="font-weight:600">
              {{ progress.done }}/{{ progress.total }}
            </span>
          </div>
          <el-progress :percentage="Math.round(progress.done / progress.total * 100)"
            :status="progress.done === progress.total ? 'success' : 'warning'" :stroke-width="8" />
          <div class="mt12">
            <ExamList :exams="exams" @view="openReport" />
          </div>
        </div>

        <!-- 右栏：评估表单 -->
        <div>
          <div class="section-h">
            评估结论
            <span class="src">评估医师：{{ state.session.name }}</span>
          </div>

          <el-radio-group v-model="evalType" size="small" style="margin-bottom:12px">
            <el-radio-button label="SPECIALIST">专科评估</el-radio-button>
            <el-radio-button label="ANESTHESIA">麻醉评估</el-radio-button>
          </el-radio-group>

          <div v-if="status === 'REPORT_PENDING'" class="hint-box warn" style="margin-bottom:12px">
            <el-icon><Warning /></el-icon>
            <div>尚有 {{ progress.total - progress.done }} 项检查报告未出（{{ missingNames }}），暂不能提交评估。</div>
          </div>

          <!-- 已出结论：只读展示，不可撤销 -->
          <el-form v-if="existing" label-width="104px" disabled>
            <el-form-item label="评估类型">
              <el-input :model-value="TYPE_LABEL[existing.type]" class="field-readonly" />
            </el-form-item>
            <el-form-item label="评估结论">
              <el-input :model-value="existing.conclusion === 'PASSED' ? '通过' : '不通过'" class="field-readonly" />
            </el-form-item>
            <el-form-item v-if="existing.type === 'ANESTHESIA'" label="ASA 分级">
              <el-input :model-value="existing.asa || '—'" class="field-readonly" />
            </el-form-item>
            <el-form-item v-if="existing.type === 'ANESTHESIA'" label="麻醉方式">
              <el-input :model-value="existing.anesthesiaMethod || '—'" class="field-readonly" />
            </el-form-item>
            <el-form-item v-if="existing.reason" label="未通过原因">
              <el-input :model-value="existing.reason + (existing.reasonNote ? '：' + existing.reasonNote : '')" class="field-readonly" />
            </el-form-item>
            <el-form-item label="评估意见">
              <el-input :model-value="existing.opinion || '—'" type="textarea" :rows="3" class="field-readonly" />
            </el-form-item>
          </el-form>

          <!-- 未出结论：可填写 -->
          <el-form v-else label-width="104px" :disabled="readonly">
            <template v-if="evalType === 'SPECIALIST'">
              <el-form-item label="评估结论" required>
                <el-radio-group v-model="form.conclusion">
                  <el-radio label="PASSED">通过，可进入麻醉评估</el-radio>
                  <el-radio label="FAILED">不通过</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item v-if="form.conclusion === 'FAILED'" label="未通过原因" required>
                <el-select v-model="form.reason" placeholder="请选择常见原因" style="width:100%">
                  <el-option v-for="r in enabledReasons" :key="r.code" :label="r.name" :value="r.name" />
                </el-select>
                <div class="tiny mt8">常见原因由「基础数据 › 评估原因字典」维护，共 {{ enabledReasons.length }} 条。</div>
              </el-form-item>
              <el-form-item v-if="form.conclusion === 'FAILED' && form.reason === '其他'" label="补充说明" required>
                <el-input v-model="form.reasonNote" type="textarea" :rows="3" maxlength="200" show-word-limit />
              </el-form-item>
              <el-form-item label="评估意见">
                <el-input v-model="form.opinion" type="textarea" :rows="4"
                  placeholder="术前检查结果、合并症与手术耐受性判断" />
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="ASA 分级" required>
                <el-radio-group v-model="form.asa">
                  <el-radio v-for="a in ASA_LEVELS" :key="a" :label="a">{{ a }}</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="评估结论" required>
                <el-radio-group v-model="form.conclusion">
                  <el-radio label="PASSED">通过</el-radio>
                  <el-radio label="FAILED">不通过</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="建议麻醉方式">
                <el-select v-model="form.anesthesiaMethod" placeholder="请选择（创建预约时自动带出）" style="width:100%">
                  <el-option v-for="t in ANESTHESIA_TYPES" :key="t" :label="t" :value="t" />
                </el-select>
              </el-form-item>
              <el-form-item label="风险说明" :required="form.asa === 'ASA III'">
                <el-input v-model="form.riskNote" type="textarea" :rows="3" maxlength="200" show-word-limit
                  :placeholder="form.asa === 'ASA III' ? 'ASA III 级必须填写风险说明与术中监护要求' : '选填'" />
              </el-form-item>
              <el-form-item v-if="form.conclusion === 'FAILED'" label="未通过原因" required>
                <el-select v-model="form.reason" placeholder="请选择常见原因" style="width:100%">
                  <el-option v-for="r in enabledReasons" :key="r.code" :label="r.name" :value="r.name" />
                </el-select>
              </el-form-item>
            </template>

            <el-form-item label="评估流程节点">
              <div class="flex gap6" style="flex-wrap:wrap">
                <el-tag size="small" type="info">术前访视</el-tag>
                <span class="muted">→</span>
                <el-tag size="small" :type="evalType === 'ANESTHESIA' ? 'primary' : 'info'">ASA 分级</el-tag>
                <span class="muted">→</span>
                <el-tag size="small" type="info">麻醉方式建议</el-tag>
                <span class="muted">→</span>
                <el-tag size="small" type="info">结论</el-tag>
              </div>
            </el-form-item>
          </el-form>

          <div class="flex gap8" style="justify-content:flex-end">
            <el-button v-if="can('deposit')" @click="goDeposit">前往储值金管理</el-button>
            <el-button
              v-if="!existing && !readonly && can('eval.submit')"
              type="primary"
              :disabled="progress.done < progress.total || !canSubmit"
              @click="submit"
            >
              提交{{ evalType === 'ANESTHESIA' ? '麻醉' : '专科' }}评估
            </el-button>
          </div>

          <div v-if="existing" class="hint-box info mt12">
            <el-icon><CircleCheck /></el-icon>
            <div>
              该患者{{ TYPE_LABEL[existing.type] }}已于 {{ existing.time.slice(0, 16) }} 由 {{ existing.doctor }} 提交，
              结论：<b>{{ existing.conclusion === 'PASSED' ? '通过' : '不通过' }}</b>
              <span v-if="existing.asa">（{{ existing.asa }} · {{ existing.anesthesiaMethod }}）</span>。
              评估结论一经提交即写入留痕，<strong>不可撤销</strong>。
            </div>
          </div>
          <div v-if="!existing && readonly && !can('eval.submit')" class="hint-box warn mt12">
            <el-icon><Warning /></el-icon>
            <div>当前岗位无评估权限，仅可查看检查报告与已有结论。</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-head">
        <div class="card-title">该患者评估留痕</div>
        <div class="card-sub">只追加、不可修改；进行中状态的全部操作均在此留痕</div>
        <div v-if="can('log')" class="right">
          <el-button text size="small" @click="router.push('/log')">查看全部日志</el-button>
        </div>
      </div>
      <el-table :data="traceRows" size="small" border style="width:100%">
        <el-table-column label="时间" width="146">
          <template #default="{ row }"><span class="num">{{ row.time.slice(0, 16) }}</span></template>
        </el-table-column>
        <el-table-column label="操作人" width="110">
          <template #default="{ row }">{{ row.operator }}<span class="muted tiny"> · {{ row.role }}</span></template>
        </el-table-column>
        <el-table-column label="动作" width="90" align="center">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ ACTION_LABEL[row.action] || row.action }}</el-tag></template>
        </el-table-column>
        <el-table-column label="对象" prop="targetName" min-width="150" show-overflow-tooltip />
        <el-table-column prop="reason" label="原因 / 说明" min-width="220" show-overflow-tooltip />
        <el-table-column label="结果" width="70" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.result === 'FAIL' ? '#c53030' : '#2f855a' }">
              {{ row.result === 'FAIL' ? '失败' : '成功' }}
            </span>
          </template>
        </el-table-column>
        <template #empty><div class="empty">该患者暂无评估留痕</div></template>
      </el-table>
    </div>

    <ReportDrawer v-model="reportDlg" :report="report" />
  </div>

  <div v-else class="card">
    <div class="empty" style="padding:80px 0">
      <div class="big">—</div>
      未找到该患者，请返回列表重新选择
      <div class="mt8"><el-button type="primary" @click="backToList">返回列表</el-button></div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Warning, InfoFilled } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import * as evalStore from '@/store/evals'
import { get as getPatient } from '@/store/patients'
import { queryByPatient } from '@/store/logs'
import { fetchExamReports } from '@/api/his'
import { ANESTHESIA_TYPES, WITHDRAW_REASON_ANESTHESIA } from '@/mock/dict'
import { ACTION_LABEL } from '@/utils/audit'
import ExamList from '@/components/ExamList.vue'
import ReportDrawer from '@/components/ReportDrawer.vue'
import PatientHeader from '@/components/PatientHeader.vue'

const route = useRoute()
const router = useRouter()
const exams = ref([])
const reportDlg = ref(false)
const report = ref(null)

const evalType = ref('SPECIALIST')
const form = reactive({ conclusion: 'PASSED', reason: '', reasonNote: '', opinion: '', asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '' })

const patient = computed(() => getPatient(route.params.patientId))
const status = computed(() => evalStore.statusOf(patient.value))
const EVAL_STATUS = evalStore.EVAL_STATUS
const TYPE_LABEL = evalStore.TYPE_LABEL
const ASA_LEVELS = evalStore.ASA_LEVELS

const existing = computed(() => {
  if (!patient.value) return null
  return evalStore.latest(patient.value.patientId, evalType.value)
})
// 无评估权限 → 表单只读（护士可查看报告，但不能改结论）
const readonly = computed(() => !can('eval.submit'))

const progress = computed(() => ({
  total: exams.value.length || 4,
  done: exams.value.filter((e) => e.reportStatus === '已出').length
}))
const missingNames = computed(() => exams.value.filter((e) => e.reportStatus !== '已出').map((e) => e.name).join('、'))
const enabledReasons = computed(() => state.dicts.evalReasons.filter((r) => r.enabled))

// 麻醉评估必须在专科评估通过之后
const canSubmit = computed(() => {
  if (!patient.value) return false
  if (evalType.value === 'ANESTHESIA') {
    const sp = evalStore.latest(patient.value.patientId, 'SPECIALIST')
    return !!sp && sp.conclusion === 'PASSED'
  }
  return true
})

const traceRows = computed(() => {
  if (!patient.value) return []
  return queryByPatient(patient.value.patientId)
    .slice()
    .sort((a, b) => String(b.time).localeCompare(String(a.time)) || b.seq - a.seq)
})

watch(patient, (p) => {
  if (!p) return
  // 默认落在「当前该做的下一步」上
  const st = evalStore.statusOf(p)
  evalType.value = st === 'ANESTHESIA_PENDING' ? 'ANESTHESIA' : 'SPECIALIST'
  if (st === 'FINISHED' || st === 'FAILED') {
    const sp = evalStore.latest(p.patientId, 'SPECIALIST')
    const an = evalStore.latest(p.patientId, 'ANESTHESIA')
    evalType.value = an ? 'ANESTHESIA' : (sp ? 'SPECIALIST' : 'SPECIALIST')
  }
  resetForm()
  loadExams(p.patientId)
}, { immediate: true })

watch(evalType, () => resetForm())

function resetForm() {
  const p = patient.value
  Object.assign(form, {
    conclusion: 'PASSED', reason: '', reasonNote: '', opinion: '',
    asa: 'ASA II', anesthesiaMethod: evalStore.latest(p?.patientId, 'ANESTHESIA')?.anesthesiaMethod || '全身麻醉',
    riskNote: ''
  })
  if (p?.evalFailReason) {
    form.conclusion = 'FAILED'
    form.reason = p.evalFailReason
  }
}

async function loadExams(id) {
  try {
    const res = await fetchExamReports(id)
    exams.value = res.exams
  } catch (e) {
    exams.value = []
  }
}

function openReport(exam) {
  report.value = { ...exam.report, reportName: exam.name, reportTime: exam.reportTime, source: exam.source }
  reportDlg.value = true
}

function submit() {
  if (!patient.value) return
  if (form.conclusion === 'FAILED' && !form.reason) return ElMessage.warning('请选择未通过原因')
  if (form.conclusion === 'FAILED' && form.reason === '其他' && !form.reasonNote) return ElMessage.warning('选择「其他」时必须填写补充说明')
  if (evalType.value === 'ANESTHESIA' && ['ASA III', 'ASA IV'].includes(form.asa) && !form.riskNote) {
    return ElMessage.warning('ASA III 级及以上患者必须填写麻醉风险说明')
  }

  const doIt = () => {
    try {
      if (evalType.value === 'ANESTHESIA') {
        evalStore.submitAnesthesia(patient.value.patientId, { ...form })
        if (form.conclusion === 'PASSED') ElMessage.success(`麻醉评估已通过，患者 ${patient.value.name} 可创建手术预约`)
        else ElMessage.warning(`麻醉评估不通过已记录，该患者不能创建手术预约，已自动退出日间手术路径（退出原因：${WITHDRAW_REASON_ANESTHESIA}）`)
      } else {
        evalStore.submitSpecialist(patient.value.patientId, { ...form })
        if (form.conclusion === 'PASSED') ElMessage.success(`专科评估已通过，患者 ${patient.value.name} 已流转至待麻醉评估`)
        else ElMessage.warning('评估不通过已记录。该患者不能创建手术预约，已自动退出日间手术路径（退出原因：评估不通过）')
      }
      resetForm()
      // 专科通过后自动切到麻醉评估；全部完成则回到列表
      if (evalType.value === 'SPECIALIST' && form.conclusion === 'PASSED') {
        evalType.value = 'ANESTHESIA'
      } else {
        router.push('/evaluation')
      }
    } catch (e) { ElMessage.error(e.message) }
  }

  if (form.conclusion === 'FAILED') {
    // 招标第 16 项：评估不通过即自动退出日间路径，退出原因按评估类型记
    const autoReason = evalType.value === 'ANESTHESIA' ? WITHDRAW_REASON_ANESTHESIA : '评估不通过'
    ElMessageBox.confirm(
      `确认提交「不通过」评估结论？提交后该患者将不能创建手术预约，且结论不可撤销；并自动退出日间手术路径，退出原因记为「${autoReason}」（${form.reason === '其他' ? form.reasonNote : form.reason}）。`,
      '提交不通过结论', { type: 'warning', confirmButtonText: '确认提交', cancelButtonText: '再想想' }
    ).then(doIt).catch(() => {})
  } else doIt()
}

function goDeposit() {
  if (patient.value) router.push('/deposit/' + patient.value.patientId)
}

function backToList() {
  router.push('/evaluation')
}
</script>
