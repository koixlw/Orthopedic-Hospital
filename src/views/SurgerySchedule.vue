<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">手术排程</div>
        <div class="card-sub">日视图按手术间分列、按台次排序；调整安排后自动比对预约信息并生成变动通知</div>
        <div class="right">
          <el-button v-if="can('sch.create')" type="primary" :icon="Plus" @click="openCreate()">创建预约</el-button>
          <el-radio-group v-model="view" size="small" style="margin-left:8px">
            <el-radio-button label="day">日视图</el-radio-button>
            <el-radio-button label="list">列表视图</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div class="toolbar" style="margin-bottom:14px">
        <el-button-group>
          <el-button :icon="ArrowLeft" size="small" @click="shift(-1)" />
          <el-button size="small" @click="goToday">今天</el-button>
          <el-button :icon="ArrowRight" size="small" @click="shift(1)" />
        </el-button-group>
        <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" size="small" style="width:150px" />
        <span style="font-size:14px;font-weight:700">{{ dateLabel }}</span>
        <span class="muted">当日 {{ daySchedules.length }} 台</span>
        <div class="legend" style="margin-left:auto">
          <span><i style="background:#2b6cb0"></i>已预约</span>
          <span><i style="background:#c05621"></i>已变更</span>
          <span><i style="background:#2f855a"></i>已报到</span>
          <span><i style="background:#a0aec0"></i>已完成</span>
        </div>
      </div>

      <!-- 日视图 -->
      <div v-if="view === 'day'" class="board">
        <div class="board-head">
          <div>台次 / 手术间</div>
          <div v-for="r in ROOMS" :key="r">{{ r }}</div>
        </div>
        <div v-for="seq in SEQS" :key="seq" class="board-row">
          <div class="board-seq">第 {{ seq }} 台</div>
          <div v-for="r in ROOMS" :key="r" class="board-cell">
            <ScheduleCard
              v-if="cell(r, seq)"
              :schedule="cell(r, seq)"
              :patient="getPatient(cell(r, seq).patientId)"
              @click="openAdjust"
            />
            <div v-else class="slot-empty" @click="openCreate({ room: r, seq })">
              <el-icon style="margin-right:4px"><Plus /></el-icon> 排这里
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <el-table v-else :data="daySchedules" size="small" border style="width:100%">
        <el-table-column label="手术日期" width="112">
          <template #default="{ row }">
            <div class="num">{{ row.surgeryDate.slice(5) }}</div>
            <div class="tiny">{{ weekOf(row.surgeryDate) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="台次 / 手术间" width="126">
          <template #default="{ row }">第 {{ row.seq }} 台 · {{ row.room }}</template>
        </el-table-column>
        <el-table-column label="患者" width="126">
          <template #default="{ row }">
            <div>{{ pname(row.patientId) }}</div>
            <div class="tiny mono">{{ pno(row.patientId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="手术名称" min-width="140">
          <template #default="{ row }">{{ pSurgery(row.patientId) }}</template>
        </el-table-column>
        <el-table-column label="主刀 / 麻醉" width="150">
          <template #default="{ row }">
            <div>{{ row.surgeon }}</div>
            <div class="tiny">{{ row.anesthesiaType }}</div>
          </template>
        </el-table-column>
        <el-table-column label="预约 vs 安排" width="170">
          <template #default="{ row }">
            <span v-if="!row.isChanged" class="muted">与预约一致</span>
            <el-tooltip v-else placement="top">
              <template #content>
                预约：{{ row.bookedDate }} {{ row.bookedRoom }} 第 {{ row.bookedSeq }} 台<br />
                安排：{{ row.surgeryDate }} {{ row.room }} 第 {{ row.seq }} 台
              </template>
              <span style="color:#c05621;font-weight:600">
                {{ row.bookedDate.slice(5) }} → {{ row.surgeryDate.slice(5) }}
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="96">
          <template #default="{ row }">
            <el-tag size="small" :type="S_STATUS[row.status].type">{{ S_STATUS[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="right">
          <template #default="{ row }">
            <el-button v-if="can('sch.adjust')" link type="primary" size="small" @click="openAdjust(row)">调整安排</el-button>
            <el-button v-if="can('sch.cancel')" link type="danger" size="small" @click="openCancel(row)">取消预约</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="empty">当日暂无手术排程</div></template>
      </el-table>
    </div>

    <!-- 待排程患者：两项评估均通过但尚未安排手术 -->
    <div class="card" style="margin-top:14px">
      <div class="card-head">
        <div class="card-title">待排程患者</div>
        <div class="card-sub">两项评估均通过、尚未安排手术的患者；点击「安排手术」带入上方日视图的空档</div>
        <div class="right"><span class="tiny muted">共 {{ candidates.length }} 人</span></div>
      </div>
      <el-table :data="candidates" size="small" border style="width:100%">
        <el-table-column label="患者" width="150">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div class="tiny mono">{{ row.inpatientNo }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="surgeryName" label="手术名称" min-width="170" show-overflow-tooltip />
        <el-table-column label="主刀 / 拟手术日" width="150">
          <template #default="{ row }">
            <div>{{ row.surgeon }}</div>
            <div class="tiny">拟 {{ row.plannedSurgeryDate }}</div>
          </template>
        </el-table-column>
        <el-table-column label="术前评估" width="182">
          <template #default="{ row }">
            <el-tag size="small" :type="row.evalStatus?.specialist === 'PASSED' ? 'success' : 'info'" effect="plain" style="margin-right:6px">
              专科{{ row.evalStatus?.specialist === 'PASSED' ? '通过' : '待评' }}
            </el-tag>
            <el-tag size="small" :type="row.evalStatus?.anesthesia === 'PASSED' ? 'success' : 'info'" effect="plain">
              麻醉{{ row.evalStatus?.anesthesia === 'PASSED' ? '通过' : '待评' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="缴费 / 冻结" width="126">
          <template #default="{ row }">
            <span class="tiny">{{ accText(row.patientId) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="right">
          <template #default="{ row }">
            <el-button v-if="can('sch.create')" link type="primary" size="small" @click="openCreate({ patientId: row.patientId })">安排手术</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="empty">暂无待排程患者</div></template>
      </el-table>
    </div>

    <!-- 创建预约 -->
    <el-drawer v-model="createDlg" title="创建手术预约" size="520px">
      <div class="notice-bar">
        <el-icon><InfoFilled /></el-icon>
        仅列出两项评估均通过的患者。创建后自动发送预约成功短信，并按参数生成入院前提醒。
      </div>
      <el-form label-width="96px">
        <el-form-item label="患者" required>
          <el-select v-model="createForm.patientId" filterable placeholder="搜索姓名或住院号" style="width:100%">
            <el-option v-for="p in candidates" :key="p.patientId"
              :label="`${p.name}　${p.inpatientNo}　${p.surgeryName}`" :value="p.patientId" />
          </el-select>
          <div v-if="createPatient" class="tiny mt8">
            {{ createPatient.surgeryName }} · {{ createPatient.diagnosis }} · 拟手术日 {{ createPatient.plannedSurgeryDate }}
          </div>
        </el-form-item>
        <el-form-item label="手术日期" required>
          <el-date-picker v-model="createForm.surgeryDate" type="date" value-format="YYYY-MM-DD" style="width:100%"
            :disabled-date="disableDate" />
        </el-form-item>
        <el-form-item label="手术间" required>
          <el-select v-model="createForm.room" style="width:100%">
            <el-option v-for="r in ROOMS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="台次" required>
          <el-select v-model="createForm.seq" style="width:100%">
            <el-option v-for="s in SEQS" :key="s" :label="`第 ${s} 台`" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="主刀医师" required>
          <el-select v-model="createForm.surgeon" style="width:100%">
            <el-option label="张海涛" value="张海涛" />
            <el-option label="李伟" value="李伟" />
          </el-select>
        </el-form-item>
        <el-form-item label="麻醉医师">
          <el-select v-model="createForm.anesthesiologist" style="width:100%">
            <el-option label="李伟" value="李伟" />
            <el-option label="王强" value="王强" />
          </el-select>
        </el-form-item>
        <el-form-item label="麻醉方式">
          <el-select v-model="createForm.anesthesiaType" style="width:100%">
            <el-option v-for="t in ANESTHESIA_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
          <div class="tiny mt8">预填值为麻醉评估建议：{{ evalMethod }}</div>
        </el-form-item>
      </el-form>

      <template v-if="createConflict">
        <div class="hint-box" style="border-color:#f3c7c7;background:#fff7f7;color:#b03a3a">
          <el-icon><Warning /></el-icon>
          <div>该时段已被 {{ createConflict.patient }} 占用（{{ createForm.room }} · 第 {{ createForm.seq }} 台），请调整后再提交。</div>
        </div>
        <div v-if="createSuggest" class="hint-box warn mt8">
          <el-icon><MagicStick /></el-icon>
          <div class="flex" style="justify-content:space-between;width:100%">
            <span>建议改为「{{ createSuggest.room }} · {{ createForm.surgeryDate }} · 第 {{ createSuggest.seq }} 台」</span>
            <el-button size="small" type="warning" plain @click="applySuggest">采用建议</el-button>
          </div>
        </div>
      </template>

      <template #footer>
        <el-button @click="createDlg = false">取消</el-button>
        <el-button type="primary" :disabled="!!createConflict || !createForm.patientId" @click="doCreate">确认创建</el-button>
      </template>
    </el-drawer>

    <!-- 调整安排 -->
    <el-drawer v-model="adjustDlg" title="调整手术安排" size="560px">
      <template v-if="adjustRow">
        <div class="section-h">预约信息（患者已被告知）<span class="src">灰底只读，永不修改</span></div>
        <div class="compare" style="grid-template-columns:1fr;gap:0">
          <div class="side-card" style="background:#f5f7fa">
            <div class="kv" style="grid-template-columns:96px 1fr 96px 1fr">
              <div class="k">预约日期</div><div class="v num">{{ adjustRow.bookedDate }}</div>
              <div class="k">预约手术间</div><div class="v">{{ adjustRow.bookedRoom }}</div>
              <div class="k">预约台次</div><div class="v">第 {{ adjustRow.bookedSeq }} 台</div>
              <div class="k">预约主刀</div><div class="v">{{ adjustRow.bookedSurgeon }}</div>
            </div>
          </div>
        </div>

        <div class="section-h mt12">调整后安排</div>
        <el-form label-width="96px">
          <el-form-item label="手术日期">
            <el-date-picker v-model="adjustForm.surgeryDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
          </el-form-item>
          <el-form-item label="手术间">
            <el-select v-model="adjustForm.room" style="width:100%">
              <el-option v-for="r in ROOMS" :key="r" :label="r" :value="r" />
            </el-select>
          </el-form-item>
          <el-form-item label="台次">
            <el-select v-model="adjustForm.seq" style="width:100%">
              <el-option v-for="s in SEQS" :key="s" :label="`第 ${s} 台`" :value="s" />
            </el-select>
          </el-form-item>
          <el-form-item label="主刀">
            <el-select v-model="adjustForm.surgeon" style="width:100%">
              <el-option label="张海涛" value="张海涛" />
              <el-option label="李伟" value="李伟" />
            </el-select>
          </el-form-item>
          <el-form-item label="变更原因" required>
            <el-select v-model="adjustForm.reason" placeholder="请选择" style="width:100%">
              <el-option v-for="r in ['手术室临时调整', '患者要求改期', '主刀排班变动', '术前准备不足', '其他']" :key="r" :label="r" :value="r" />
            </el-select>
          </el-form-item>
          <el-form-item label="通知渠道" required>
            <el-radio-group v-model="adjustForm.channel">
              <el-radio label="短信">短信</el-radio>
              <el-radio label="电话">电话</el-radio>
              <el-radio label="BOTH">短信 + 电话</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>

        <div v-if="isDiff" class="hint-box warn" style="margin-top:4px">
          <el-icon><Warning /></el-icon>
          <div>
            该调整与患者预约信息不一致（{{ diffText }}），保存后将向患者发送变更通知。
            预约记录保留原值，用于对比与追溯。
          </div>
        </div>
        <div v-else class="hint-box info" style="margin-top:4px">
          <el-icon><CircleCheck /></el-icon>
          <div>当前安排与预约信息一致，保存后不会生成变更通知。</div>
        </div>
      </template>
      <template #footer>
        <el-button @click="adjustDlg = false">取消</el-button>
        <el-button type="primary" @click="doAdjust">保存并通知</el-button>
      </template>
    </el-drawer>

    <!-- 取消预约 -->
    <el-dialog v-model="cancelDlg" title="取消手术预约" width="440px">
      <el-form label-width="88px">
        <el-form-item label="取消原因" required>
          <el-select v-model="cancelReason" placeholder="请选择" style="width:100%">
            <el-option v-for="r in CANCEL_REASONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="hint-box warn">
        <el-icon><Warning /></el-icon>
        取消后患者状态回到「术前准备」，已生成的通知将作废。
      </div>
      <template #footer>
        <el-button @click="cancelDlg = false">取消</el-button>
        <el-button type="danger" @click="doCancel">确认取消预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage } from 'element-plus'
import { Plus, ArrowLeft, ArrowRight, MagicStick, Warning } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { SURGERY_ROOMS, SURGERY_SEQS, ANESTHESIA_TYPES, CANCEL_REASONS } from '@/mock/dict'
import { get as getPatient } from '@/store/patients'
import * as sched from '@/store/schedules'
import { latest } from '@/store/evals'
import ScheduleCard from '@/components/ScheduleCard.vue'
import { fmtDateCn, fmtAmount } from '@/utils/format'
import { accountOf } from '@/store/accounts'

const ROOMS = SURGERY_ROOMS
const SEQS = SURGERY_SEQS
const S_STATUS = sched.STATUS_MAP
const route = useRoute()
const router = useRouter()

const view = ref('day')
const date = ref(dayjs().format('YYYY-MM-DD'))
const createDlg = ref(false)
const adjustDlg = ref(false)
const adjustRow = ref(null)
const cancelDlg = ref(false)
const cancelTarget = ref(null)
const cancelReason = ref('')

const createForm = reactive({
  patientId: '', surgeryDate: date.value, room: '日间 1 间', seq: 1,
  surgeon: '张海涛', anesthesiologist: '李伟', anesthesiaType: '全身麻醉'
})
const adjustForm = reactive({ surgeryDate: '', room: '', seq: 1, surgeon: '', reason: '', channel: 'BOTH' })

const dateLabel = computed(() => fmtDateCn(date.value))
const daySchedules = computed(() => sched.byDate(date.value).sort((a, b) => a.seq - b.seq))
const candidates = computed(() => sched.scheduleable())
const createPatient = computed(() => getPatient(createForm.patientId))
const evalMethod = computed(() => {
  const rec = latest(createForm.patientId, 'ANESTHESIA')
  return rec?.anesthesiaMethod || '未记录，建议按麻醉评估结论选择'
})

const createConflict = computed(() =>
  sched.conflict(createForm.surgeryDate, createForm.room, createForm.seq))
const createSuggest = computed(() => sched.suggest(createForm.surgeryDate))

const isDiff = computed(() => {
  const s = adjustRow.value
  if (!s) return false
  return s.bookedDate !== adjustForm.surgeryDate || s.bookedRoom !== adjustForm.room ||
    Number(s.bookedSeq) !== Number(adjustForm.seq) || s.bookedSurgeon !== adjustForm.surgeon
})
const diffText = computed(() => {
  const s = adjustRow.value
  if (!s) return ''
  return `${s.bookedDate.slice(5)} ${s.bookedRoom} 第 ${s.bookedSeq} 台 → ${(adjustForm.surgeryDate || '').slice(5)} ${adjustForm.room} 第 ${adjustForm.seq} 台`
})

const cell = (room, seq) => daySchedules.value.find((s) => s.room === room && Number(s.seq) === Number(seq)) || null
const pname = (id) => getPatient(id)?.name || '—'
const pno = (id) => getPatient(id)?.inpatientNo || ''
const pSurgery = (id) => getPatient(id)?.surgeryName || ''
const weekOf = (d) => '周' + ['日', '一', '二', '三', '四', '五', '六'][dayjs(d).day()]
const accText = (id) => {
  const a = accountOf(id)
  if (!a) return '未开户'
  const label = { NORMAL: '正常', FROZEN: '已冻结', TRANSFERRED_IN: '已转住院', SETTLED: '已结算' }[a.status] || a.status
  return `${label} ¥${fmtAmount(a.frozen || a.available)}`
}

watch(date, (d) => { createForm.surgeryDate = d })

const queryPatient = route.query.patient
if (queryPatient) {
  openCreate({ patientId: queryPatient })
}

function shift(n) {
  date.value = dayjs(date.value).add(n, 'day').format('YYYY-MM-DD')
}
function goToday() { date.value = dayjs().format('YYYY-MM-DD') }
function disableDate(d) {
  return dayjs(d).isBefore(dayjs().startOf('day')) || dayjs(d).isAfter(dayjs().add(30, 'day'))
}

function openCreate(preset = {}) {
  createForm.surgeryDate = preset.surgeryDate || date.value
  createForm.room = preset.room || '日间 1 间'
  createForm.seq = preset.seq || 1
  createForm.patientId = preset.patientId || (candidates.value[0]?.patientId || '')
  createForm.surgeon = '张海涛'
  createForm.anesthesiologist = '李伟'
  createForm.anesthesiaType = '全身麻醉'
  createDlg.value = true
}

function applySuggest() {
  if (!createSuggest.value) return
  createForm.room = createSuggest.value.room
  createForm.seq = createSuggest.value.seq
}

function doCreate() {
  try {
    const rec = sched.create({ ...createForm })
    createDlg.value = false
    ElMessage.success(`已为 ${pname(rec.patientId)} 预约 ${rec.surgeryDate} ${rec.room} 第 ${rec.seq} 台，预约成功短信已发送`)
    date.value = rec.surgeryDate
  } catch (e) { ElMessage.error(e.message) }
}

function openAdjust(row) {
  adjustRow.value = row
  Object.assign(adjustForm, {
    surgeryDate: row.surgeryDate, room: row.room, seq: row.seq, surgeon: row.surgeon,
    reason: '', channel: 'BOTH'
  })
  adjustDlg.value = true
}

function doAdjust() {
  if (!adjustForm.reason) return ElMessage.warning('请选择变更原因')
  try {
    const s = sched.adjust(adjustRow.value.scheduleId, { ...adjustForm }, adjustForm.reason, adjustForm.channel)
    adjustDlg.value = false
    ElMessage.success(s.isChanged
      ? `手术安排已调整，变更通知已发送（${adjustForm.channel === 'BOTH' ? '短信 + 电话' : adjustForm.channel}）。预约记录保留原值，用于对比。`
      : '手术安排已保存，与预约信息一致，未生成变更通知')
    date.value = s.surgeryDate
  } catch (e) { ElMessage.error(e.message) }
}

function openCancel(row) {
  cancelTarget.value = row
  cancelReason.value = ''
  cancelDlg.value = true
}

function doCancel() {
  if (!cancelReason.value) return ElMessage.warning('请选择取消原因')
  try {
    sched.cancel(cancelTarget.value.scheduleId, cancelReason.value)
    cancelDlg.value = false
    ElMessage.success('预约已取消，患者状态回到术前准备，通知已作废')
  } catch (e) { ElMessage.error(e.message) }
}
</script>
