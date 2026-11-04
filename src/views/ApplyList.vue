<template>
  <div>
    <div class="notice-bar">
      <el-icon><InfoFilled /></el-icon>
      <span>日间手术申请单由门急诊诊间医生站开立，本系统接收后办理建档与术前流程。开单内容不可修改，业务模式可由医生修正。</span>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">手术申请单</div>
        <div class="card-sub">接收 HIS 申请单 → 抗凝剂停药校验 → 建档进入术前流程</div>
        <div class="right">
          <el-button type="primary" :icon="Download" :loading="loading" @click="openReceive">接收 HIS 申请单</el-button>
        </div>
      </div>

      <div class="toolbar">
        <el-radio-group v-model="filters.status" size="small">
          <el-radio-button label="PENDING">待建档</el-radio-button>
          <el-radio-button label="ARCHIVED">已建档</el-radio-button>
          <el-radio-button label="RETURNED">已退回</el-radio-button>
        </el-radio-group>
        <el-select v-model="filters.bizMode" placeholder="业务模式" clearable style="width:140px">
          <el-option v-for="m in BIZ_MODES" :key="m" :label="m" :value="m" />
        </el-select>
        <el-input v-model="filters.keyword" placeholder="申请单号 / 住院号 / 姓名" clearable :prefix-icon="Search" style="width:230px" />
        <span class="muted" style="margin-left:auto">共 {{ rows.length }} 条</span>
      </div>

      <el-table :data="rows" size="small" border style="width:100%">
        <el-table-column label="申请单号" width="134">
          <template #default="{ row }"><span class="mono">{{ row.applyNo }}</span></template>
        </el-table-column>
        <el-table-column label="患者" width="114">
          <template #default="{ row }">
            <div>{{ row.patientName }}</div>
            <div class="tiny mono">{{ row.inpatientNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="业务模式" width="94">
          <template #default="{ row }">
            <el-tag size="small" :type="BIZ_MODE_TYPE[row.bizMode]">{{ row.bizMode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="surgeryName" label="手术名称" min-width="128" show-overflow-tooltip />
        <el-table-column prop="plannedSurgeryDate" label="拟手术日" width="96">
          <template #default="{ row }"><span class="num">{{ row.plannedSurgeryDate }}</span></template>
        </el-table-column>
        <el-table-column label="申请科室 / 开单医师" width="126">
          <template #default="{ row }">
            <div>{{ row.applyDept }}</div>
            <div class="tiny">{{ row.applyDoctor }} · {{ (row.applyTime || '').slice(0, 10) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="抗凝停药" width="104">
          <template #default="{ row }">
            <span :class="antiCoag(row).type === 'danger' ? 'amount-red' : antiCoag(row).type === 'success' ? 'amount-green' : 'muted'">
              {{ antiCoag(row).text }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="STATUS_MAP[row.status].type">{{ STATUS_MAP[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="176" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING'">
              <el-tooltip :disabled="canApply(row)" content="口服抗凝剂需停药满 7 天" placement="top">
                <span>
                  <el-button link type="primary" size="small" :disabled="!canApply(row)" @click="openBuild(row)">建档</el-button>
                </span>
              </el-tooltip>
              <el-button link type="primary" size="small" @click="openCorrect(row)">修正</el-button>
              <el-button link type="danger" size="small" @click="openReturn(row)">退回</el-button>
            </template>
            <el-button v-else-if="row.status === 'ARCHIVED'" link type="primary" size="small" @click="goPatient(row)">查看患者</el-button>
            <el-button v-else link type="info" size="small" @click="viewReturn(row)">查看</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="empty"><div class="big">—</div>该状态下暂无申请单</div></template>
      </el-table>
    </div>

    <!-- 接收 HIS 申请单 -->
    <el-dialog v-model="receiveDlg" title="接收 HIS 日间手术申请单" width="800px">
      <div class="notice-bar">
        <el-icon><InfoFilled /></el-icon>
        以下申请单来自 HIS 诊间申请单表（模拟），已接收的申请单不再出现在列表中。
      </div>
      <el-table ref="poolTable" :data="pool" size="small" border @selection-change="onPoolSelect">
        <el-table-column type="selection" width="42" />
        <el-table-column prop="applyNo" label="申请单号" width="134">
          <template #default="{ row }"><span class="mono">{{ row.applyNo }}</span></template>
        </el-table-column>
        <el-table-column label="患者" width="112">
          <template #default="{ row }">
            <div>{{ row.patientName }} <span class="tiny">{{ row.gender }}/{{ row.age }}</span></div>
            <div class="tiny mono">{{ row.inpatientNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="业务模式" width="92">
          <template #default="{ row }"><el-tag size="small" :type="BIZ_MODE_TYPE[row.bizMode]">{{ row.bizMode }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="surgeryName" label="手术名称" min-width="124" show-overflow-tooltip />
        <el-table-column prop="plannedSurgeryDate" label="拟手术日" width="96" />
        <el-table-column label="抗凝停药天数" width="104">
          <template #default="{ row }">
            <span :class="poolAntiCoag(row).type === 'danger' ? 'amount-red' : 'amount-green'">{{ poolAntiCoag(row).text }}</span>
          </template>
        </el-table-column>
        <template #empty><div class="empty">待接收池中没有新的申请单</div></template>
      </el-table>
      <template #footer>
        <span class="muted" style="float:left;line-height:32px">已选 {{ selected.length }} 条</span>
        <el-button @click="receiveDlg = false">取消</el-button>
        <el-button type="primary" :disabled="!selected.length" @click="doReceive">确认接收</el-button>
      </template>
    </el-dialog>

    <!-- 修正申请单 -->
    <el-drawer v-model="correctDlg" title="修正申请单信息" size="480px">
      <template v-if="correctRow">
        <div class="notice-bar">
          <el-icon><Lock /></el-icon>
          患者姓名、住院号、开单医师、开单时间来自 HIS，不可修改。
        </div>
        <el-form label-width="96px">
          <el-form-item label="申请单号">
            <el-input :model-value="correctRow.applyNo" disabled class="field-readonly" />
          </el-form-item>
          <el-form-item label="患者">
            <el-input :model-value="`${correctRow.patientName}　${correctRow.inpatientNo}`" disabled class="field-readonly" />
          </el-form-item>
          <el-form-item label="业务模式">
            <el-radio-group v-model="correctForm.bizMode">
              <el-radio v-for="m in BIZ_MODES" :key="m" :label="m">{{ m }}</el-radio>
            </el-radio-group>
            <div class="tiny mt8">该模式影响费用结构：手术不麻醉不含麻醉费；麻醉不手术不含手术费。</div>
          </el-form-item>
          <el-form-item label="手术名称">
            <el-input v-model="correctForm.surgeryName" />
          </el-form-item>
          <el-form-item label="拟手术日">
            <el-date-picker v-model="correctForm.plannedSurgeryDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
          </el-form-item>
          <el-form-item label="主刀医师">
            <el-select v-model="correctForm.surgeon" style="width:100%">
              <el-option label="张海涛" value="张海涛" />
              <el-option label="李伟" value="李伟" />
            </el-select>
          </el-form-item>
          <el-form-item label="口服抗凝剂">
            <el-switch v-model="correctForm.antiCoagulant" />
            <div v-if="correctForm.antiCoagulant" class="mt8" style="width:100%">
              <el-date-picker v-model="correctForm.antiCoagStopDate" type="date" value-format="YYYY-MM-DD"
                placeholder="停药日期" style="width:100%" />
              <div class="tiny mt8" :class="previewDays < 7 ? 'amount-red' : 'amount-green'">
                停药 {{ previewDays }} 天，{{ previewDays >= 7 ? '已满足建档条件' : '暂不可建档（需满 7 天）' }}
              </div>
            </div>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="correctDlg = false">取消</el-button>
        <el-button type="primary" @click="doCorrect">保存修正</el-button>
      </template>
    </el-drawer>

    <!-- 建档 -->
    <el-dialog v-model="buildDlg" title="从申请单建档" width="620px">
      <template v-if="buildRow">
        <div class="notice-bar">
          <el-icon><InfoFilled /></el-icon>
          患者信息由申请单带出，建档只补床位与责任护士。患者进入系统仅此一条通道。
        </div>
        <el-form label-width="96px">
          <el-form-item label="患者姓名">
            <el-input :model-value="buildRow.patientName" disabled class="field-readonly" />
          </el-form-item>
          <el-form-item label="住院号">
            <el-input :model-value="buildRow.inpatientNo" disabled class="field-readonly" />
          </el-form-item>
          <el-form-item label="手术名称">
            <el-input :model-value="buildRow.surgeryName" disabled class="field-readonly" />
          </el-form-item>
          <el-form-item label="业务模式">
            <el-input :model-value="buildRow.bizMode" disabled class="field-readonly" />
          </el-form-item>
          <el-form-item label="床位">
            <el-select v-model="buildForm.bedNo" placeholder="可选择，入院登记时可再分配" clearable style="width:100%">
              <el-option v-for="b in beds" :key="b" :label="b" :value="b" />
            </el-select>
          </el-form-item>
          <el-form-item label="责任护士">
            <el-select v-model="buildForm.nurse" placeholder="请选择" style="width:100%">
              <el-option label="陈静" value="陈静" />
              <el-option label="刘敏" value="刘敏" />
            </el-select>
          </el-form-item>
          <el-form-item label="过敏史">
            <el-input v-model="buildForm.allergy" placeholder="如：青霉素；无则填「无」" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="buildDlg = false">取消</el-button>
        <el-button type="primary" @click="doBuild">确认建档</el-button>
      </template>
    </el-dialog>

    <!-- 退回 -->
    <el-dialog v-model="returnDlg" title="退回申请单" width="460px">
      <el-form label-width="88px">
        <el-form-item label="退回原因" required>
          <el-select v-model="returnForm.reason" placeholder="请选择" style="width:100%">
            <el-option v-for="r in ['患者取消手术', '开单信息错误', '重复开单', '其他']" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="returnForm.reason === '其他'" label="补充说明" required>
          <el-input v-model="returnForm.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDlg = false">取消</el-button>
        <el-button type="danger" @click="doReturn">确认退回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { fetchApplyPool } from '@/api/his'
import { state } from '@/store/db'
import {
  all, STATUS_MAP, BIZ_MODE_TYPE, canApply, antiCoagText, receive, correct, returnApply, buildPatient
} from '@/store/applies'
import { BIZ_MODES } from '@/mock/dict'

const router = useRouter()
const filters = reactive({ status: 'PENDING', bizMode: '', keyword: '' })
const loading = ref(false)
const receiveDlg = ref(false)
const pool = ref([])
const selected = ref([])
const poolTable = ref(null)

const correctDlg = ref(false)
const correctRow = ref(null)
const correctForm = reactive({ bizMode: '', surgeryName: '', plannedSurgeryDate: '', surgeon: '', antiCoagulant: false, antiCoagStopDate: '' })

const buildDlg = ref(false)
const buildRow = ref(null)
const buildForm = reactive({ bedNo: '', nurse: '陈静', allergy: '无' })
const beds = ['日间 01 床', '日间 02 床', '日间 03 床', '日间 05 床', '日间 06 床']

const returnDlg = ref(false)
const returnRow = ref(null)
const returnForm = reactive({ reason: '', note: '' })

const rows = computed(() => all.value
  .filter((a) => !filters.status || a.status === filters.status)
  .filter((a) => !filters.bizMode || a.bizMode === filters.bizMode)
  .filter((a) => {
    const kw = filters.keyword.trim()
    return !kw || a.applyNo.includes(kw) || a.inpatientNo.includes(kw) || a.patientName.includes(kw)
  })
  .slice()
  .sort((a, b) => (a.applyTime < b.applyTime ? 1 : -1)))

const antiCoag = (row) => antiCoagText(row)
const poolAntiCoag = (row) => {
  if (!row.antiCoagulant) return { text: '—', type: 'info' }
  const days = dayjs().diff(dayjs(row.antiCoagStopDate), 'day')
  return days >= 7 ? { text: `已满 7 天（${days} 天）`, type: 'success' } : { text: `${days}/7 天`, type: 'danger' }
}

const previewDays = computed(() => {
  if (!correctForm.antiCoagStopDate) return 0
  return dayjs().diff(dayjs(correctForm.antiCoagStopDate), 'day')
})

async function openReceive() {
  receiveDlg.value = true
  loading.value = true
  try {
    const res = await fetchApplyPool()
    pool.value = res.list
    await nextTick()
    poolTable.value?.clearSelection()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

function onPoolSelect(sel) { selected.value = sel }

function doReceive() {
  try {
    receive(selected.value)
    receiveDlg.value = false
    ElMessage.success(`已接收 ${selected.value.length} 条申请单，可继续办理建档`)
    filters.status = 'PENDING'
  } catch (e) { ElMessage.error(e.message) }
}

function openCorrect(row) {
  correctRow.value = row
  Object.assign(correctForm, {
    bizMode: row.bizMode, surgeryName: row.surgeryName, plannedSurgeryDate: row.plannedSurgeryDate,
    surgeon: row.surgeon, antiCoagulant: !!row.antiCoagulant, antiCoagStopDate: row.antiCoagStopDate || ''
  })
  correctDlg.value = true
}

function doCorrect() {
  try {
    correct(correctRow.value.applyId, { ...correctForm }, '修正申请单信息')
    const days = correctForm.antiCoagulant && correctForm.antiCoagStopDate
      ? dayjs().diff(dayjs(correctForm.antiCoagStopDate), 'day') : null
    if (days !== null && days < 7) {
      ElMessage.warning(`停药 ${days}/7 天，暂不可建档`)
    } else {
      ElMessage.success('申请单已修正，列表状态已同步更新')
    }
    correctDlg.value = false
  } catch (e) { ElMessage.error(e.message) }
}

function openBuild(row) {
  buildRow.value = row
  buildForm.bedNo = ''
  buildForm.nurse = '陈静'
  buildForm.allergy = '无'
  buildDlg.value = true
}

function doBuild() {
  try {
    const p = buildPatient(buildRow.value.applyId, { ...buildForm })
    if (buildForm.nurse) p.nurse = buildForm.nurse
    buildDlg.value = false
    ElMessage.success(`已为 ${p.name} 建档，住院号 ${p.inpatientNo}，已进入术前准备`)
    filters.status = 'ARCHIVED'
  } catch (e) { ElMessage.error(e.message) }
}

function openReturn(row) {
  returnRow.value = row
  returnForm.reason = ''
  returnForm.note = ''
  returnDlg.value = true
}

function doReturn() {
  if (!returnForm.reason) return ElMessage.warning('请选择退回原因')
  if (returnForm.reason === '其他' && !returnForm.note) return ElMessage.warning('选择「其他」时必须填写补充说明')
  try {
    returnApply(returnRow.value.applyId, returnForm.reason, returnForm.note)
    returnDlg.value = false
    ElMessage.success('申请单已退回，患者不会进入本系统流程')
  } catch (e) { ElMessage.error(e.message) }
}

function viewReturn(row) {
  ElMessageBox.alert(
    `申请单 ${row.applyNo} 已退回。\n退回原因：${row.returnReason || '—'}${row.returnNote ? '（' + row.returnNote + '）' : ''}`,
    '已退回申请单', { confirmButtonText: '知道了' }
  )
}

function goPatient(row) {
  router.push('/trace/' + row.patientId)
}
</script>
