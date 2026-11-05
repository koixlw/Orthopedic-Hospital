<template>
  <div v-if="patient">
    <PatientHeader :patient="patient" />

    <div class="card" style="padding:10px 16px">
      <div class="flex gap12" style="font-size:12.5px;color:#4b5563;flex-wrap:wrap">
        <span>手术名称：<b>{{ patient.surgeryName }}</b></span>
        <span>手术间：<b>{{ schedule?.room || patient.surgeryRoom || '—' }}</b></span>
        <span>手术日期：<b>{{ patient.plannedSurgeryDate }}</b></span>
        <span>主刀：<b>{{ patient.surgeon }}</b></span>
        <span>麻醉方式：<b>{{ schedule?.anesthesiaType || '—' }}</b></span>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">手术医嘱录入</div>
        <div class="card-sub">手术过程中使用的麻醉药必须至少录入 1 条（招标第 13 项）</div>
        <div class="right">
          <span class="muted">共 {{ list.length }} 条 ｜ 麻醉药 {{ anestheticCount }} 条 ｜ 执行中 {{ activeCount }} 条</span>
        </div>
      </div>

      <div class="toolbar">
        <el-radio-group v-model="form.type" size="small">
          <el-radio-button label="临时">临时医嘱</el-radio-button>
          <el-radio-button label="长期">长期医嘱</el-radio-button>
        </el-radio-group>
        <span class="tiny">医嘱类型决定可否停嘱：长期医嘱可停嘱，临时医嘱一次执行</span>
      </div>

      <div class="entry-row">
        <div class="fld" style="flex:1.5">
          <div class="lb">药品</div>
          <el-select v-model="form.drugCode" filterable :filter-method="filterDrug" placeholder="输入中文或拼音首字母，如 bbf"
            style="width:100%" @change="onDrug">
            <el-option v-for="d in drugOptions" :key="d.code" :label="d.name" :value="d.code">
              <span>{{ d.name }}</span>
              <span class="tiny" style="float:right">{{ d.spec }}</span>
            </el-option>
          </el-select>
        </div>
        <div class="fld" style="width:118px">
          <div class="lb">规格</div>
          <el-input :model-value="drug?.spec" disabled class="field-readonly" />
        </div>
        <div class="fld" style="width:110px">
          <div class="lb">剂量</div>
          <el-input-number v-model="form.dose" :min="0" :precision="2" controls-position="right" style="width:100%" />
        </div>
        <div class="fld" style="width:74px">
          <div class="lb">单位</div>
          <el-input :model-value="drug?.unit" disabled class="field-readonly" />
        </div>
        <div class="fld" style="width:116px">
          <div class="lb">用法</div>
          <el-select v-model="form.usage" style="width:100%">
            <el-option v-for="u in USAGES" :key="u" :label="u" :value="u" />
          </el-select>
        </div>
        <div class="fld" style="width:116px">
          <div class="lb">频次</div>
          <el-select v-model="form.freq" style="width:100%">
            <el-option v-for="f in FREQS" :key="f" :label="f" :value="f" />
          </el-select>
        </div>
        <div class="fld" style="width:170px">
          <div class="lb">开始时间</div>
          <el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm" style="width:100%" />
        </div>
        <div class="fld" style="width:96px">
          <div class="lb">&nbsp;</div>
          <el-button v-if="can('ord.add')" type="primary" style="width:100%" @click="doAdd">添加医嘱</el-button>
        </div>
      </div>

      <div class="toolbar mt12">
        <el-select v-model="filter.type" placeholder="类型" clearable size="small" style="width:110px">
          <el-option label="长期医嘱" value="长期" />
          <el-option label="临时医嘱" value="临时" />
        </el-select>
        <el-select v-model="filter.anes" placeholder="是否麻醉药" clearable size="small" style="width:130px">
          <el-option label="仅麻醉药" value="1" />
          <el-option label="非麻醉药" value="0" />
        </el-select>
        <el-select v-model="filter.status" placeholder="状态" clearable size="small" style="width:120px">
          <el-option label="执行中" value="执行中" />
          <el-option label="已执行" value="已执行" />
          <el-option label="已停止" value="已停止" />
          <el-option label="已作废" value="已作废" />
        </el-select>
        <el-input v-model="filter.kw" placeholder="药品名称" clearable size="small" :prefix-icon="Search" style="width:160px" />
        <el-switch v-model="showRemoved" size="small" active-text="显示已移除" style="margin-left:auto" />
      </div>

      <el-table :data="rows" size="small" border style="width:100%" :row-class-name="rowClass">
        <el-table-column label="类型" width="72" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === '长期' ? 'primary' : 'info'" effect="plain">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="药品" min-width="220">
          <template #default="{ row }">
            <div class="flex gap6" style="align-items:center;min-width:0">
              <span
                :class="{ strike: row.removed || row.execStatus === '已作废' }"
                style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                :title="row.drugName"
              >{{ row.drugName }}</span>
              <el-tag v-if="row.isAnesthetic" size="small" type="danger" effect="dark" style="flex:none">麻醉</el-tag>
              <el-tag v-if="row.removed" size="small" type="info" style="flex:none">已移除</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="spec" label="规格" width="96" />
        <el-table-column label="剂量" width="84" align="right">
          <template #default="{ row }"><span class="num">{{ row.dose }} {{ row.unit }}</span></template>
        </el-table-column>
        <el-table-column prop="usage" label="用法" width="76" />
        <el-table-column prop="freq" label="频次" width="80" />
        <el-table-column label="开始时间" width="132">
          <template #default="{ row }"><span class="num">{{ (row.startTime || '').slice(0, 16) }}</span></template>
        </el-table-column>
        <el-table-column prop="doctor" label="开嘱医师" width="72" />
        <el-table-column label="状态" width="92" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="stTag(row)">{{ row.execStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <template v-if="row.execStatus === '执行中' && !row.removed">
              <el-button v-if="can('ord.add')" link type="primary" size="small" @click="openEdit(row)">修改</el-button>
              <el-button v-if="row.type === '长期' && can('ord.stop')" link type="warning" size="small" @click="openStop(row)">停嘱</el-button>
              <el-button v-if="can('ord.remove')" link type="danger" size="small" @click="doRemove(row)">移除</el-button>
            </template>
            <template v-else-if="row.execStatus === '已执行'">
              <el-button v-if="can('ord.void')" link type="danger" size="small" @click="openVoid(row)">作废</el-button>
            </template>
            <el-button v-else-if="row.removed && can('ord.add')" link type="primary" size="small" @click="doRestore(row)">恢复</el-button>
            <span v-else class="tiny">—</span>
          </template>
        </el-table-column>
        <template #empty><div class="empty">尚未录入手术医嘱</div></template>
      </el-table>
    </div>

    <div class="cols c2" style="margin-top:14px">
      <div class="card">
        <div class="section-h">麻醉药核对<span class="src">招标第 13 项：至少包含手术过程中使用的麻醉药</span></div>
        <div class="flex gap8" style="align-items:center">
          <el-icon :color="anesRows.length ? '#2f855a' : '#c53030'" style="font-size:20px">
            <component :is="anesRows.length ? 'CircleCheck' : 'CircleClose'" />
          </el-icon>
          <div>
            <div style="font-size:13px;font-weight:600">
              {{ anesRows.length ? `已录入 ${anesRows.length} 条麻醉药` : '尚未录入麻醉药' }}
            </div>
            <div class="tiny">{{ anesRows.length ? '术中用药可追溯，麻醉药品名称、剂量、用法、频次均已记录。' : '请在上方药品检索中录入麻醉药后再提交。' }}</div>
          </div>
        </div>
        <div class="mt12" style="display:flex;flex-wrap:wrap;gap:6px">
          <el-tag v-for="r in anesRows" :key="r.orderId" type="danger" effect="plain" size="small">
            {{ r.drugName }} {{ r.dose }}{{ r.unit }}
          </el-tag>
          <span v-if="!anesRows.length" class="tiny muted">—</span>
        </div>
      </div>

      <div class="card">
        <div class="section-h">医嘱录入规则</div>
        <div class="rule-list">
          <div><b>临时医嘱</b>一次执行，不可停嘱；<b>长期医嘱</b>可停嘱，停嘱后保留记录与停嘱时间。</div>
          <div>已执行医嘱不能修改，只能<b>作废</b>；作废后灰显保留，可追溯。</div>
          <div>移除仅对未执行医嘱生效，被移除的记录可用「显示已移除」查看并<b>恢复</b>。</div>
          <div>每一次录入、修改、停嘱、作废都会写入操作日志，含操作人与时间。</div>
        </div>
      </div>
    </div>

    <el-drawer v-model="editDlg" title="修改医嘱" size="440px">
      <template v-if="editRow">
        <el-form label-width="88px">
          <el-form-item label="药品"><el-input :model-value="editRow.drugName" disabled class="field-readonly" /></el-form-item>
          <el-form-item label="剂量">
            <el-input-number v-model="editForm.dose" :min="0" :precision="2" style="width:100%" />
          </el-form-item>
          <el-form-item label="用法">
            <el-select v-model="editForm.usage" style="width:100%">
              <el-option v-for="u in USAGES" :key="u" :label="u" :value="u" />
            </el-select>
          </el-form-item>
          <el-form-item label="频次">
            <el-select v-model="editForm.freq" style="width:100%">
              <el-option v-for="f in FREQS" :key="f" :label="f" :value="f" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="editDlg = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-drawer>
  </div>
  <PickPatient v-else to="/order" title="请选择患者后录入手术医嘱"
    :statuses="['ADMITTED', 'IN_SURGERY']"
    desc="手术医嘱按患者开立，选择下方已入院患者或返回工作台，从「待办」中进入该患者医嘱页" />
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { state } from '@/store/db'
import { get as getPatient } from '@/store/patients'
import { activeSchedule } from '@/store/schedules'
import * as ord from '@/store/orders'
import { USAGES, FREQS } from '@/mock/dict'
import PatientHeader from '@/components/PatientHeader.vue'
import PickPatient from '@/components/PickPatient.vue'

const PY = {
  D0001: 'bbf bingbofen', D0002: 'rfnt ruifentaini', D0003: 'bbsaq bl', D0004: 'mdzl midazuolun',
  D0005: 'liduokayin ldk', D0006: 'angdanst', D0007: 'toubaofuxin', D0008: 'luhuana',
  D0009: 'rusuanlinshi', D0010: 'pantuolazuo', D0011: 'dipanmisong', D0012: 'qumaduo'
}

const route = useRoute()
const filter = reactive({ type: '', anes: '', status: '', kw: '' })
const showRemoved = ref(false)
const editDlg = ref(false)
const editRow = ref(null)
const editForm = reactive({ dose: 0, usage: '', freq: '' })
const drugKw = ref('')

const form = reactive({
  type: '临时', drugCode: '', drugName: '', spec: '', dose: 0, unit: '',
  usage: '', freq: '一次', startTime: dayjs().format('YYYY-MM-DD HH:mm:ss'), isAnesthetic: false
})

const patient = computed(() => (route.params.patientId ? getPatient(route.params.patientId) : null))
const schedule = computed(() => (patient.value ? activeSchedule(patient.value.patientId) : null))
const list = computed(() => (patient.value ? ord.listOf(patient.value.patientId) : []))
const drug = computed(() => state.dicts.drugs.find((d) => d.code === form.drugCode))
const drugOptions = computed(() => state.dicts.drugs.filter((d) => {
  if (!drugKw.value) return d.enabled
  const kw = drugKw.value.toLowerCase()
  return d.enabled && (d.name.includes(drugKw.value) || (PY[d.code] || '').includes(kw))
}))
const anestheticCount = computed(() => list.value.filter((o) => o.isAnesthetic && !o.removed).length)
const activeCount = computed(() => list.value.filter((o) => o.execStatus === '执行中' && !o.removed).length)
// 麻醉药核对：招标第 13 项要求手术医嘱至少包含术中使用的麻醉药
const anesRows = computed(() => list.value.filter((o) => o.isAnesthetic && !o.removed && o.execStatus !== '已作废'))

const rows = computed(() => list.value
  .filter((o) => showRemoved.value || !o.removed)
  .filter((o) => !filter.type || o.type === filter.type)
  .filter((o) => !filter.anes || (filter.anes === '1' ? o.isAnesthetic : !o.isAnesthetic))
  .filter((o) => !filter.status || o.execStatus === filter.status)
  .filter((o) => !filter.kw || o.drugName.includes(filter.kw)))

function filterDrug(v) { drugKw.value = v }

function onDrug(code) {
  const d = state.dicts.drugs.find((x) => x.code === code)
  if (!d) return
  form.drugName = d.name
  form.spec = d.spec
  form.dose = d.dose
  form.unit = d.unit
  form.usage = d.usage
  form.isAnesthetic = d.isAnesthetic
}

function doAdd() {
  try {
    ord.add(patient.value.patientId, { ...form })
    ElMessage.success(`已添加医嘱：${form.drugName} ${form.dose}${form.unit} ${form.usage}${form.isAnesthetic ? '（麻醉药）' : ''}`)
    form.drugCode = ''
    form.drugName = ''
    form.dose = 0
    form.spec = ''
    form.unit = ''
    form.usage = ''
  } catch (e) { ElMessage.error(e.message) }
}

function stTag(row) {
  return { 执行中: 'success', 已执行: 'primary', 已停止: 'info', 已作废: 'info' }[row.execStatus] || 'info'
}

function openEdit(row) {
  editRow.value = row
  Object.assign(editForm, { dose: row.dose, usage: row.usage, freq: row.freq })
  editDlg.value = true
}

function saveEdit() {
  try {
    ord.patch(editRow.value.orderId, { dose: editForm.dose, usage: editForm.usage, freq: editForm.freq }, '调整医嘱剂量与用法')
    editDlg.value = false
    ElMessage.success('医嘱已更新')
  } catch (e) { ElMessage.error(e.message) }
}

function doRemove(row) {
  ElMessageBox.confirm(`确认移除医嘱「${row.drugName} ${row.dose}${row.unit} ${row.usage}」？移除后灰显保留，可随时恢复。`, '移除医嘱', {
    type: 'warning', confirmButtonText: '确认移除', cancelButtonText: '取消'
  }).then(() => {
    try {
      ord.remove(row.orderId, '录入错误')
      ElMessage.warning('已移除该条医嘱，可在「显示已移除」中恢复')
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function doRestore(row) {
  try {
    ord.restore(row.orderId)
    ElMessage.success('医嘱已恢复')
  } catch (e) { ElMessage.error(e.message) }
}

function openStop(row) {
  ElMessageBox.prompt('停止长期医嘱需填写停止原因，停止时间默认当前时间。', '停止长期医嘱', {
    inputPlaceholder: '如：手术结束，转术后医嘱',
    inputValidator: (v) => (v && v.trim() ? true : '请填写停止原因'),
    confirmButtonText: '确认停嘱'
  }).then(({ value }) => {
    try {
      ord.stop(row.orderId, value)
      ElMessage.success('医嘱已停止，有效医嘱计数已更新')
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function openVoid(row) {
  ElMessageBox.prompt('已执行医嘱只能作废，不能移除。请填写作废原因。', '作废已执行医嘱', {
    inputPlaceholder: '如：术中未使用，按实际执行情况作废',
    inputValidator: (v) => (v && v.trim() ? true : '请填写作废原因'),
    confirmButtonText: '确认作废'
  }).then(({ value }) => {
    try {
      ord.voidOrder(row.orderId, value)
      ElMessage.info('医嘱已作废，记录灰显保留')
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function rowClass({ row }) {
  return row.removed || row.execStatus === '已作废' ? 'row-void' : ''
}
</script>

<style scoped>
.entry-row { display: flex; gap: 8px; align-items: flex-end; background: #fafbfd; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.entry-row .lb { font-size: 11.5px; color: #8a94a6; margin-bottom: 4px; }
.entry-row .fld { min-width: 0; }
.rule-list { display: grid; gap: 7px; font-size: 12.5px; color: var(--ink-2); line-height: 1.65; }
.rule-list b { color: var(--ink); font-weight: 600; }
</style>
