<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">术前评估</div>
        <div class="card-sub">检查报告齐全 → 专科评估 → 麻醉评估，三项顺序不可颠倒</div>
        <div class="right">
          <el-select v-if="list.length" v-model="selectedId" placeholder="选择患者" size="small" style="width:210px">
            <el-option v-for="p in list" :key="p.patientId" :label="`${p.name} ${p.inpatientNo}`" :value="p.patientId" />
          </el-select>
        </div>
      </div>

      <el-tabs v-model="tab" @tab-change="onTab">
        <el-tab-pane name="specialist">
          <template #label>待专科评估 <span class="tiny">（{{ evalStore.pendingSpecialist().length }}）</span></template>
        </el-tab-pane>
        <el-tab-pane name="anesthesia">
          <template #label>待麻醉评估 <span class="tiny">（{{ evalStore.pendingAnesthesia().length }}）</span></template>
        </el-tab-pane>
        <el-tab-pane name="done">
          <template #label>已完成 <span class="tiny">（{{ evalStore.finished().length }}）</span></template>
        </el-tab-pane>
        <el-tab-pane name="failed">
          <template #label>评估不通过 <span class="tiny">（{{ evalStore.failed().length }}）</span></template>
        </el-tab-pane>
      </el-tabs>

      <template v-if="!patient">
        <div class="empty"><div class="big">—</div>{{ emptyText }}</div>
      </template>

      <template v-else>
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
              {{ isAnesthesia ? '麻醉评估' : '专科评估' }}
              <span class="src">评估医师：{{ state.session.name }}</span>
            </div>

            <div v-if="progress.done < progress.total" class="hint-box warn" style="margin-bottom:12px">
              <el-icon><Warning /></el-icon>
              <div>尚有 {{ progress.total - progress.done }} 项检查报告未出（{{ missingNames }}），暂不能提交评估。</div>
            </div>

            <el-form label-width="104px" :disabled="readonly">
              <template v-if="!isAnesthesia">
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
                    <el-radio v-for="a in ['ASA I', 'ASA II', 'ASA III', 'ASA IV']" :key="a" :label="a">{{ a }}</el-radio>
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
                  <el-tag size="small" :type="isAnesthesia ? 'primary' : 'info'">ASA 分级</el-tag>
                  <span class="muted">→</span>
                  <el-tag size="small" type="info">麻醉方式建议</el-tag>
                  <span class="muted">→</span>
                  <el-tag size="small" type="info">结论</el-tag>
                </div>
              </el-form-item>
            </el-form>

            <div class="flex gap8" style="justify-content:flex-end">
              <el-button v-if="existing" type="warning" plain @click="openRevoke">撤销评估</el-button>
              <el-button v-if="existing" @click="goDeposit">前往储值金管理</el-button>
              <el-button v-if="!readonly" type="primary" :disabled="progress.done < progress.total" @click="submit">
                提交{{ isAnesthesia ? '麻醉' : '专科' }}评估
              </el-button>
            </div>

            <div v-if="existing" class="hint-box info mt12">
              <el-icon><CircleCheck /></el-icon>
              <div>
                该患者{{ isAnesthesia ? '麻醉' : '专科' }}评估已于 {{ existing.time.slice(0, 16) }} 由 {{ existing.doctor }} 提交，
                结论：<b>{{ existing.conclusion === 'PASSED' ? '通过' : '不通过' }}</b>
                <span v-if="existing.asa">（{{ existing.asa }} · {{ existing.anesthesiaMethod }}）</span>。
                如需修改须先撤销，撤销需填写原因。
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <ReportDrawer v-model="reportDlg" :report="report" />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { state } from '@/store/db'
import * as evalStore from '@/store/evals'
import { get as getPatient } from '@/store/patients'
import { fetchExamReports } from '@/api/his'
import { ANESTHESIA_TYPES, WITHDRAW_REASONS } from '@/mock/dict'
import ExamList from '@/components/ExamList.vue'
import ReportDrawer from '@/components/ReportDrawer.vue'

const route = useRoute()
const router = useRouter()
const tab = ref('specialist')
const selectedId = ref('')
const exams = ref([])
const loading = ref(false)
const reportDlg = ref(false)
const report = ref(null)

const form = reactive({ conclusion: 'PASSED', reason: '', reasonNote: '', opinion: '', asa: 'ASA II', anesthesiaMethod: '全身麻醉', riskNote: '' })

const isAnesthesia = computed(() => tab.value === 'anesthesia')
const patient = computed(() => (selectedId.value ? getPatient(selectedId.value) : null))

const list = computed(() => {
  if (tab.value === 'specialist') return evalStore.pendingSpecialist()
  if (tab.value === 'anesthesia') return evalStore.pendingAnesthesia()
  if (tab.value === 'done') return evalStore.finished()
  return evalStore.failed()
})

const emptyText = computed(() => ({
  specialist: '当前没有待专科评估的患者',
  anesthesia: '当前没有待麻醉评估的患者',
  done: '暂无已完成的评估记录',
  failed: '暂无评估不通过的患者'
}[tab.value]))

const existing = computed(() => {
  if (!patient.value) return null
  const type = isAnesthesia.value ? 'ANESTHESIA' : 'SPECIALIST'
  return evalStore.latest(patient.value.patientId, type)
})
const readonly = computed(() => !!existing.value)

const progress = computed(() => ({
  total: exams.value.length || 4,
  done: exams.value.filter((e) => e.reportStatus === '已出').length
}))
const missingNames = computed(() => exams.value.filter((e) => e.reportStatus !== '已出').map((e) => e.name).join('、'))
const enabledReasons = computed(() => state.dicts.evalReasons.filter((r) => r.enabled))

watch(list, (v) => {
  if (!v.length) { selectedId.value = ''; exams.value = []; return }
  if (!v.some((p) => p.patientId === selectedId.value)) selectedId.value = v[0].patientId
}, { immediate: true })

watch(selectedId, async (id) => {
  resetForm()
  if (!id) return
  loading.value = true
  try {
    const res = await fetchExamReports(id)
    exams.value = res.exams
  } catch (e) {
    exams.value = []
  } finally {
    loading.value = false
  }
}, { immediate: true })

function onTab() { resetForm() }

function resetForm() {
  const p = patient.value
  Object.assign(form, {
    conclusion: 'PASSED', reason: '', reasonNote: '', opinion: '',
    asa: 'ASA II', anesthesiaMethod: evalStore.latest(selectedId.value, 'ANESTHESIA')?.anesthesiaMethod || '全身麻醉',
    riskNote: ''
  })
  if (tab.value === 'failed' && p?.evalFailReason) {
    form.conclusion = 'FAILED'
    form.reason = p.evalFailReason
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
  if (isAnesthesia.value && form.asa === 'ASA III' && !form.riskNote) return ElMessage.warning('ASA III 级必须填写风险说明')

  const doIt = () => {
    try {
      if (isAnesthesia.value) {
        evalStore.submitAnesthesia(patient.value.patientId, { ...form })
        if (form.conclusion === 'PASSED') ElMessage.success(`麻醉评估已通过，患者 ${patient.value.name} 可创建手术预约`)
        else ElMessage.warning('麻醉评估不通过已记录，该患者不能创建手术预约，可办理退出日间手术')
      } else {
        evalStore.submitSpecialist(patient.value.patientId, { ...form })
        if (form.conclusion === 'PASSED') ElMessage.success(`专科评估已通过，患者 ${patient.value.name} 已流转至待麻醉评估`)
        else ElMessage.warning('评估不通过已记录。该患者不能创建手术预约，可办理退出日间手术（原因已预填）')
      }
      tab.value = form.conclusion === 'PASSED' ? (isAnesthesia.value ? 'done' : 'anesthesia') : 'failed'
      resetForm()
    } catch (e) { ElMessage.error(e.message) }
  }

  if (form.conclusion === 'FAILED') {
    ElMessageBox.confirm(
      `确认提交「不通过」评估结论？提交后该患者将不能创建手术预约，如需退出日间手术，退出原因将自动填为「${form.reason === '其他' ? form.reasonNote : form.reason}」。`,
      '提交不通过结论', { type: 'warning', confirmButtonText: '确认提交', cancelButtonText: '再想想' }
    ).then(doIt).catch(() => {})
  } else doIt()
}

function openRevoke() {
  ElMessageBox.prompt('撤销评估需填写原因，撤销后患者回到待评估状态。', '撤销评估结论', {
    inputPlaceholder: '如：报告复读后需重新评估',
    confirmButtonText: '确认撤销',
    cancelButtonText: '取消',
    inputValidator: (v) => (v && v.trim() ? true : '请填写撤销原因')
  }).then(({ value }) => {
    try {
      evalStore.revoke(patient.value.patientId, isAnesthesia.value ? 'ANESTHESIA' : 'SPECIALIST', value)
      ElMessage.success('评估结论已撤销，患者回到待评估状态')
      resetForm()
      tab.value = isAnesthesia.value ? 'anesthesia' : 'specialist'
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function goDeposit() {
  if (patient.value) router.push('/deposit/' + patient.value.patientId)
}
</script>
