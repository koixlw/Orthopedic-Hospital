<template>
  <div v-if="patient">
    <PatientHeader :patient="patient">
      <template #actions>
        <el-select v-if="!pinned" v-model="pid" size="small" style="width:210px" @change="switchPatient">
          <el-option v-for="p in candidates" :key="p.patientId" :label="`${p.name} ${p.inpatientNo}`" :value="p.patientId" />
        </el-select>
      </template>
    </PatientHeader>

    <div class="card">
      <div class="card-head">
        <div class="card-title">转普通住院</div>
        <div class="card-sub">需录入转住院原因与转住院方式，两项均为必填（招标第 9 项 ▲）</div>
      </div>

      <div class="compare" style="margin-bottom:16px">
        <div class="side-card">
          <div class="tag">变更前</div>
          <div class="kv" style="grid-template-columns:76px 1fr">
            <div class="k">患者类型</div><div class="v">日间手术患者</div>
            <div class="k">住院号</div><div class="v mono">{{ patient.inpatientNo }}</div>
            <div class="k">拟手术日</div><div class="v num">{{ patient.plannedSurgeryDate || '—' }}</div>
            <div class="k">当前床位</div><div class="v">{{ patient.bedNo || '—' }}</div>
          </div>
        </div>
        <div class="arrow"><el-icon><Right /></el-icon></div>
        <div class="side-card after">
          <div class="tag">变更后</div>
          <div v-if="patient.transferInfo" class="kv" style="grid-template-columns:86px 1fr">
            <div class="k">患者类型</div><div class="v" style="font-weight:700">普通住院患者</div>
            <div class="k">转住院时间</div><div class="v num">{{ (patient.transferInfo.at || '').slice(0, 16) }}</div>
            <div class="k">转住院方式</div><div class="v">{{ patient.transferInfo.method }}</div>
            <div class="k">操作医师</div><div class="v">{{ patient.transferInfo.operator }}</div>
          </div>
          <div v-else class="kv" style="grid-template-columns:86px 1fr;color:#a8b0bd">
            <div class="k">患者类型</div><div class="v">普通住院患者</div>
            <div class="k">转住院时间</div><div class="v">提交后生成</div>
            <div class="k">转住院方式</div><div class="v">待选择</div>
            <div class="k">操作医师</div><div class="v">{{ state.session.name }}</div>
          </div>
        </div>
      </div>

      <el-form label-width="96px" :disabled="!!patient.transferInfo">
        <el-form-item label="转住院原因" required :error="errors.reason">
          <el-select v-model="form.reason" placeholder="请选择转住院原因" style="width:320px">
            <el-option v-for="r in TRANSFER_REASONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.reason === '其他'" label="原因说明" required :error="errors.reasonNote">
          <el-input v-model="form.reasonNote" type="textarea" :rows="2" maxlength="200" show-word-limit
            placeholder="请说明具体原因" style="width:520px" />
        </el-form-item>
        <el-form-item label="转住院方式" required :error="errors.method">
          <el-select v-model="form.method" placeholder="请选择转住院方式" style="width:320px">
            <el-option v-for="m in TRANSFER_METHODS" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" type="textarea" :rows="3" maxlength="200" show-word-limit
            placeholder="选填，200 字以内" style="width:520px" />
        </el-form-item>
      </el-form>

      <div class="flex gap8" style="justify-content:flex-end">
        <el-button @click="reset">取消</el-button>
        <el-button v-if="!patient.transferInfo && can('trf.submit')" type="primary" @click="doTransfer">确认转普通住院</el-button>
        <template v-else>
          <el-button v-if="can('trf.submit')" @click="openEdit">修改转住院信息</el-button>
          <el-button v-if="can('trf.revoke')" type="danger" plain @click="doCancel">撤销转住院</el-button>
        </template>
      </div>

      <div v-if="patient.transferInfo" class="notice-bar warn mt12">
        <el-icon><Warning /></el-icon>
        患者已完成转普通住院（{{ (patient.transferInfo.at || '').slice(0, 16) }}，{{ patient.transferInfo.operator }}）。撤销受「未发生费用」约束。
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">变更记录</div>
        <div class="card-sub">每次转住院、修改、撤销各追加一条，不可编辑</div>
      </div>
      <el-timeline v-if="logs.length">
        <el-timeline-item v-for="(l, i) in logs" :key="i" :timestamp="l.time" :type="l.type || 'primary'" placement="top">
          <div class="flex gap8" style="font-size:12.5px">
            <b>{{ l.operator }}</b>
            <span>{{ l.text }}</span>
            <el-tag v-if="l.cancelled" size="small" type="info">撤销</el-tag>
          </div>
        </el-timeline-item>
      </el-timeline>
      <div v-else class="empty" style="padding:26px 0">
        尚无变更记录
        <div class="tiny" style="margin-top:6px">提交转住院后，每次转住院、修改、撤销都会在此追加一条记录，不可编辑</div>
      </div>
    </div>

    <el-dialog v-model="editDlg" title="修改转住院信息" width="480px">
      <el-form label-width="96px">
        <el-form-item label="转住院原因" required>
          <el-select v-model="editForm.reason" style="width:100%">
            <el-option v-for="r in TRANSFER_REASONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="转住院方式" required>
          <el-select v-model="editForm.method" style="width:100%">
            <el-option v-for="m in TRANSFER_METHODS" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.note" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDlg = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
  <div v-else class="empty">暂无可办理转住院的患者（需处于「已入院」或「术中」状态）</div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Right, Warning } from '@element-plus/icons-vue'
import { state, persist } from '@/store/db'
import { get as getPatient, patchPatient } from '@/store/patients'
import { goStatus, assertCan } from '@/utils/guard'
import { log } from '@/store/logs'
import { TRANSFER_REASONS, TRANSFER_METHODS } from '@/mock/dict'
import { fmtTime } from '@/utils/format'
import PatientHeader from '@/components/PatientHeader.vue'

const route = useRoute()
const router = useRouter()
const pinned = ref(!!route.params.patientId)
const pid = ref(route.params.patientId || '')
const form = reactive({ reason: '', method: '', reasonNote: '', note: '' })
const errors = reactive({ reason: '', method: '', reasonNote: '' })
const editDlg = ref(false)
const editForm = reactive({ reason: '', method: '', note: '' })

const candidates = computed(() => state.patients.filter((p) => ['ADMITTED', 'IN_SURGERY', 'TRANSFERRED'].includes(p.status)))
if (!pid.value) pid.value = candidates.value[0]?.patientId || ''

const patient = computed(() => getPatient(pid.value))
const logs = computed(() => (patient.value?.transferHistory || []).slice().reverse())

watch(patient, (p) => {
  if (!p) return
  if (p.transferInfo) {
    form.reason = p.transferInfo.reason
    form.method = p.transferInfo.method
    form.note = p.transferInfo.note
  }
}, { immediate: true })

function switchPatient(id) {
  pinned.value = true
  router.replace('/transfer/' + id)
}

function reset() {
  if (patient.value?.transferInfo) {
    form.reason = patient.value.transferInfo.reason
    form.method = patient.value.transferInfo.method
    form.note = patient.value.transferInfo.note
  } else {
    form.reason = ''
    form.method = ''
    form.note = ''
  }
  errors.reason = ''
  errors.method = ''
}

function doTransfer() {
  assertCan('trf.submit', { module: 'TRF', page: '转普通入院', action: 'STATUS', label: '转普通住院', targetType: '转住院单' })
  errors.reason = form.reason ? '' : '请选择转住院原因'
  errors.method = form.method ? '' : '请选择转住院方式'
  if (form.reason === '其他' && !form.reasonNote) errors.reasonNote = '选择「其他」时必须填写原因说明'
  if (errors.reason || errors.method || errors.reasonNote) {
    ElMessage.warning(errors.reason || errors.method || errors.reasonNote)
    return
  }
  const p = patient.value
  ElMessageBox.confirm(`确认将患者${p.name}由日间手术转为普通住院？`, '确认转普通住院', {
    type: 'warning', confirmButtonText: '确认转住院', cancelButtonText: '取消'
  }).then(() => {
    try {
      const before = { 患者状态: '已入院/术中', 患者类型: '日间手术患者' }
      goStatus(p, 'TRANSFERRED', { by: state.session.name })
      const time = fmtTime(new Date())
      p.transferInfo = {
        reason: form.reason, method: form.method, note: form.note, at: time, operator: state.session.name
      }
      p.transferHistory = p.transferHistory || []
      p.transferHistory.push({ time, operator: state.session.name, text: `转普通住院（${form.reason} · ${form.method}）` })
      log({
        module: 'TRF', page: '转普通住院', action: 'STATUS', targetType: '患者',
        targetId: p.inpatientNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
        before, after: { 患者状态: '普通住院', 转住院原因: form.reason, 转住院方式: form.method },
        reason: `${form.reason}；方式：${form.method}${form.note ? '；备注：' + form.note : ''}`
      })
      persist()
      ElMessage.success(`患者 ${p.name} 已转为普通住院，变更记录已生成`)
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function openEdit() {
  const t = patient.value.transferInfo
  Object.assign(editForm, { reason: t.reason, method: t.method, note: t.note })
  editDlg.value = true
}

function saveEdit() {
  assertCan('trf.submit', { module: 'TRF', page: '转普通入院', action: 'UPDATE', label: '修改转住院信息', targetType: '转住院单' })
  const p = patient.value
  const t = p.transferInfo
  if (!editForm.reason || !editForm.method) return ElMessage.warning('转住院原因与方式均为必填')
  const before = { 转住院原因: t.reason, 转住院方式: t.method, 备注: t.note }
  t.reason = editForm.reason
  t.method = editForm.method
  t.note = editForm.note
  p.transferHistory.push({ time: fmtTime(new Date()), operator: state.session.name, text: `修改转住院信息（${t.reason} · ${t.method}）` })
  log({
    module: 'TRF', page: '转普通住院 › 修改', action: 'UPDATE', targetType: '转住院记录',
    targetId: p.inpatientNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
    before, after: { 转住院原因: t.reason, 转住院方式: t.method, 备注: t.note }, reason: '修改转住院原因与方式'
  })
  persist()
  editDlg.value = false
  ElMessage.success('转住院信息已更新，变更记录已追加')
}

function doCancel() {
  assertCan('trf.revoke', { module: 'TRF', page: '转普通入院', action: 'CANCEL', label: '撤销转普通住院', targetType: '转住院单' })
  const p = patient.value
  const hasCharge = state.charges.some((c) => c.patientId === p.patientId && c.status !== 'VOIDED')
  if (hasCharge) {
    ElMessage.error('已发生费用，不能撤销转住院')
    return
  }
  ElMessageBox.prompt('撤销转住院需填写原因，撤销后患者回到「已入院」。', '撤销转住院', {
    inputPlaceholder: '如：录入错误',
    inputValidator: (v) => (v && v.trim() ? true : '请填写撤销原因'),
    confirmButtonText: '确认撤销'
  }).then(({ value }) => {
    const t = p.transferInfo
    p.transferHistory.push({ time: fmtTime(new Date()), operator: state.session.name, text: `撤销转住院（原因：${value}）`, cancelled: true })
    const before = { 患者状态: '普通住院', 转住院原因: t.reason }
    p.transferInfo = null
    goStatus(p, 'ADMITTED', { by: state.session.name })
    log({
      module: 'TRF', page: '转普通住院', action: 'CANCEL', targetType: '转住院记录',
      targetId: p.inpatientNo, targetName: `${p.name} ${p.inpatientNo}`, patientId: p.patientId,
      before, after: { 患者状态: '已入院' }, reason: value
    })
    persist()
    ElMessage.success('已撤销转住院，变更记录保留')
  }).catch(() => {})
}
</script>
