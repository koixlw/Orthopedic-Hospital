<template>
  <div v-if="patient">
    <PatientHeader :patient="patient">
      <template #actions>
        <el-tag v-if="charge" size="small" :type="chargeTag" effect="plain">{{ chargeLabel }}</el-tag>
      </template>
    </PatientHeader>

    <div class="card" style="padding:10px 16px">
      <div class="flex gap12" style="font-size:12.5px;color:#4b5563;flex-wrap:wrap">
        <span>手术名称：<b>{{ patient.surgeryName }}</b></span>
        <span>手术间：<b>{{ schedule?.room || patient.surgeryRoom || '—' }}</b></span>
        <span>台次：<b>{{ schedule ? '第 ' + schedule.seq + ' 台' : '—' }}</b></span>
        <span>主刀：<b>{{ patient.surgeon }}</b></span>
        <span>手术日期：<b>{{ patient.plannedSurgeryDate }}</b></span>
        <span>麻醉方式：<b>{{ schedule?.anesthesiaType || '—' }}</b></span>
      </div>
    </div>

    <div v-if="voidedCurrent" class="notice-bar warn">
      <el-icon><Warning /></el-icon>
      费用单已于 {{ (currentDoc.voidedAt || '').slice(0, 16) }} 作废，原因：{{ currentDoc.voidReason }}。
      <el-button v-if="can('chg.reenter')" link type="primary" style="margin-left:8px" @click="doReEnter">重新录入</el-button>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">手术费用录入</div>
        <div class="card-sub">两条录入路径：手工补录 或 调用常用组套；提交后整单只读</div>
        <div class="right">
          <el-switch v-model="showRemoved" size="small" active-text="显示已移除" style="margin-right:6px" />
          <el-switch v-model="showVoided" size="small" active-text="显示已作废" />
        </div>
      </div>

      <template v-if="!readonly">
        <el-tabs v-model="tab">
          <el-tab-pane label="手工补录" name="manual" />
          <el-tab-pane label="调用常用组套" name="group" />
        </el-tabs>

        <div v-if="tab === 'group'" class="toolbar">
          <el-select v-model="groupId" placeholder="选择常用组套" style="width:400px">
            <el-option v-for="g in groups" :key="g.groupId" :label="`${g.name}（${g.lines.length} 项 · ¥${fmtAmount(g.total)}）`" :value="g.groupId" />
          </el-select>
          <el-button v-if="can('chg.import')" type="primary" :disabled="!groupId" @click="doImport">调入</el-button>
          <span v-if="currentDoc?.groupName" class="muted">已调入：{{ currentDoc.groupName }}</span>
          <span class="muted" style="margin-left:auto">组套明细可在「费用常用组套」维护，调入后数量可改</span>
        </div>

        <div class="toolbar" v-if="tab === 'manual'">
          <el-select v-model="newItemCode" filterable placeholder="搜索收费项目（编码 / 名称）" style="width:320px">
            <el-option v-for="it in chargeItems" :key="it.code" :label="`${it.name}　${it.spec}　¥${fmtAmount(it.price)}`" :value="it.code" />
          </el-select>
          <el-input-number v-model="newQty" :min="1" size="default" style="width:110px" />
          <el-button v-if="can('chg.add')" type="primary" :disabled="!newItemCode" @click="doAdd">添加一行</el-button>
          <span class="muted" style="margin-left:auto">已录入 {{ activeLines.length }} 项</span>
        </div>
      </template>

      <el-table :data="visibleLines" size="small" border style="width:100%" :row-class-name="rowClass">
        <el-table-column label="收费项目" min-width="190">
          <template #default="{ row }">
            <span :class="{ strike: row.removed }">{{ row.name }}</span>
            <el-tag v-if="row.removed" size="small" type="info" style="margin-left:6px">已移除</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec" label="规格" width="110" />
        <el-table-column prop="unit" label="单位" width="66" align="center" />
        <el-table-column label="数量" width="110" align="center">
          <template #default="{ row }">
            <el-input-number v-if="!readonly && !row.removed" v-model="row.qty" :min="1" size="small" controls-position="right"
              style="width:92px" @change="onQtyChange(row)" />
            <span v-else class="num">{{ row.qty }}</span>
          </template>
        </el-table-column>
        <el-table-column label="单价" width="110" align="right">
          <template #default="{ row }">
            <el-input-number v-if="!readonly && !row.removed" v-model="row.price" :min="0" :precision="2" size="small"
              controls-position="right" style="width:96px" @change="onQtyChange(row)" />
            <span v-else class="num">{{ fmtAmount(row.price) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120" align="right">
          <template #default="{ row }">
            <span class="num" :class="{ strike: row.removed }" style="font-weight:600">¥{{ fmtAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <template v-if="!readonly">
              <el-button v-if="!row.removed && can('chg.add')" link type="danger" size="small" @click="doRemove(row)">移除</el-button>
              <el-button v-else-if="can('chg.add')" link type="primary" size="small" @click="doRestore(row)">恢复</el-button>
            </template>
            <span v-else class="tiny">—</span>
          </template>
        </el-table-column>
        <template #empty><div class="empty">尚未录入费用明细</div></template>
      </el-table>

      <div class="flex mt12" style="justify-content:space-between;align-items:center">
        <div class="tiny">
          <template v-if="charge?.status === 'SUBMITTED'">费用已提交 · {{ (charge.submittedAt || '').slice(0, 16) }} · {{ charge.submittedBy }}</template>
          <template v-else>草稿态可修改数量与单价；移除的明细灰显保留，可随时恢复。</template>
        </div>
        <div class="flex gap12">
          <span class="muted">合计金额</span>
          <span class="amount-big">¥{{ fmtAmount(activeTotal) }}</span>
          <el-button v-if="!readonly && can('chg.add')" @click="doClear">清空</el-button>
          <el-button v-if="!readonly && can('chg.submit')" type="primary" :disabled="!activeLines.length" @click="doSubmit">提交费用</el-button>
          <el-button v-if="readonly && can('chg.void')" type="warning" plain @click="openVoid">作废费用单</el-button>
        </div>
      </div>
    </div>

    <div v-if="voidedList.length" class="card">
      <div class="card-head"><div class="card-title">历史费用单</div></div>
      <el-table :data="voidedList" size="small" border>
        <el-table-column prop="chargeId" label="费用单号" width="170" />
        <el-table-column label="合计" width="120" align="right">
          <template #default="{ row }">¥{{ fmtAmount(row.total) }}</template>
        </el-table-column>
        <el-table-column label="作废时间" width="160">
          <template #default="{ row }">{{ (row.voidedAt || '').slice(0, 16) }}</template>
        </el-table-column>
        <el-table-column prop="voidReason" label="作废原因" />
        <el-table-column label="操作" width="110">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewVoid(row)">重新录入</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="voidDlg" title="作废费用单" width="440px">
      <el-form label-width="88px">
        <el-form-item label="作废原因" required>
          <el-select v-model="voidReason" placeholder="请选择" style="width:100%">
            <el-option v-for="r in VOID_REASONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="hint-box warn"><el-icon><Warning /></el-icon>作废后整单灰显保留，可基于原明细重新录入，历史不会被抹去。</div>
      <template #footer>
        <el-button @click="voidDlg = false">取消</el-button>
        <el-button type="danger" @click="doVoid">确认作废</el-button>
      </template>
    </el-dialog>
  </div>
  <PickPatient v-else to="/charge" title="请选择患者后录入手术费用"
    desc="手术费用按患者建单，选择下方患者或返回工作台，从「待办」中进入该患者费用页" />
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fmtAmount, round2 } from '@/utils/format'
import { state } from '@/store/db'
import { get as getPatient } from '@/store/patients'
import { activeSchedule } from '@/store/schedules'
import * as chg from '@/store/charges'
import { VOID_REASONS } from '@/mock/dict'
import PatientHeader from '@/components/PatientHeader.vue'
import PickPatient from '@/components/PickPatient.vue'

const route = useRoute()
const tab = ref('manual')
const groupId = ref('')
const newItemCode = ref('')
const newQty = ref(1)
const showRemoved = ref(false)
const showVoided = ref(false)
const voidDlg = ref(false)
const voidReason = ref('')

const patient = computed(() => (route.params.patientId ? getPatient(route.params.patientId) : null))
const schedule = computed(() => (patient.value ? activeSchedule(patient.value.patientId) : null))
const currentDoc = computed(() => {
  if (!patient.value) return null
  return chg.active(patient.value.patientId) || chg.listOf(patient.value.patientId)[0] || null
})
const charge = computed(() => currentDoc.value)
const voidedCurrent = computed(() => charge.value?.status === 'VOIDED')
const voidedList = computed(() => (patient.value ? chg.listOf(patient.value.patientId).filter((c) => c.status === 'VOIDED') : []))
const readonly = computed(() => ['SUBMITTED', 'VOIDED'].includes(charge.value?.status))
const chargeLabel = computed(() => ({ DRAFT: '草稿', SUBMITTED: '已提交', VOIDED: '已作废' }[charge.value?.status] || '未录入'))
const chargeTag = computed(() => ({ DRAFT: 'info', SUBMITTED: 'success', VOIDED: 'info' }[charge.value?.status] || 'info'))

const groups = computed(() => state.dicts.groups.filter((g) => g.enabled))
const chargeItems = computed(() => state.dicts.items.filter((i) => i.enabled))

const visibleLines = computed(() => {
  const lines = charge.value?.lines || []
  return showRemoved.value ? lines : lines.filter((l) => !l.removed)
})
const activeLines = computed(() => (charge.value?.lines || []).filter((l) => !l.removed))
const activeTotal = computed(() => round2(activeLines.value.reduce((s, l) => s + Number(l.amount), 0)))

function ensure() {
  if (charge.value && charge.value.status !== 'VOIDED') return charge.value
  if (voidedCurrent.value) throw new Error('该费用单已作废，请点击「重新录入」后再编辑')
  return chg.ensureDraft(patient.value.patientId)
}

function onQtyChange(row) {
  try {
    chg.patchLine(patient.value.patientId, row.chargeItemId, { qty: row.qty, price: row.price, reason: '按实际用量修正' })
  } catch (e) { ElMessage.error(e.message) }
}

function doAdd() {
  const item = chargeItems.value.find((i) => i.code === newItemCode.value)
  if (!item) return
  try {
    ensure()
    chg.addLine(patient.value.patientId, item, newQty.value)
    newItemCode.value = ''
    newQty.value = 1
  } catch (e) { ElMessage.error(e.message) }
}

function doImport() {
  const g = groups.value.find((x) => x.groupId === groupId.value)
  if (!g) return
  if (voidedCurrent.value) return ElMessage.error('该费用单已作废，请点击「重新录入」后再调入')
  try {
    chg.importGroup(patient.value.patientId, g)
    ElMessage.success(`已调入「${g.name}」${g.lines.length} 项，合计 ¥${fmtAmount(g.total)}`)
  } catch (e) { ElMessage.error(e.message) }
}

function doRemove(row) {
  ElMessageBox.confirm(`确认移除「${row.name}」这条明细？移除后灰显保留，可随时恢复。`, '移除费用明细', {
    type: 'warning', confirmButtonText: '确认移除', cancelButtonText: '取消'
  }).then(() => {
    try {
      chg.removeLine(patient.value.patientId, row.chargeItemId, '草稿态移除')
      ElMessage.warning(`已移除 1 条明细，合计调整为 ¥${fmtAmount(activeTotal.value)} · 可在「显示已移除」中恢复`)
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function doRestore(row) {
  try {
    chg.restoreLine(patient.value.patientId, row.chargeItemId)
    ElMessage.success(`已恢复「${row.name}」¥${fmtAmount(row.amount)}，合计 ¥${fmtAmount(activeTotal.value)}`)
  } catch (e) { ElMessage.error(e.message) }
}

function doClear() {
  ElMessageBox.confirm('清空将逐条移除当前草稿的全部明细（保留可恢复记录），是否继续？', '清空明细', {
    type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消'
  }).then(() => {
    activeLines.value.forEach((l) => {
      try { chg.removeLine(patient.value.patientId, l.chargeItemId, '清空草稿') } catch (e) { /* noop */ }
    })
    ElMessage.info('已清空当前草稿明细，可在「显示已移除」中恢复')
  }).catch(() => {})
}

function doSubmit() {
  try {
    chg.submit(patient.value.patientId)
    ElMessage.success(`费用已提交，合计 ¥${fmtAmount(activeTotal.value)}`)
  } catch (e) { ElMessage.error(e.message) }
}

function openVoid() {
  voidReason.value = ''
  voidDlg.value = true
}

function doVoid() {
  if (!voidReason.value) return ElMessage.warning('请选择作废原因')
  try {
    chg.voidCharge(charge.value.chargeId, voidReason.value)
    voidDlg.value = false
    ElMessage.info(`费用单 ${charge.value.chargeId} 已作废（原因：${voidReason.value}），可基于原单重新录入`)
  } catch (e) { ElMessage.error(e.message) }
}

function doReEnter() {
  try {
    chg.reEnter(charge.value.chargeId)
    ElMessage.success('已基于原单明细新建草稿，可继续修改')
  } catch (e) { ElMessage.error(e.message) }
}

function viewVoid(row) {
  try {
    chg.reEnter(row.chargeId)
    ElMessage.success('已基于已作废费用单新建草稿')
  } catch (e) { ElMessage.error(e.message) }
}

function rowClass({ row }) {
  // 已移除的明细、以及整单作废后的全部明细，均灰显划线，不抹去记录
  return row.removed || voidedCurrent.value ? 'row-void' : ''
}
</script>
