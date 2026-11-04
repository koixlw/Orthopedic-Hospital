<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">患者全链路轨迹</div>
        <div class="card-sub">按时间正序还原一名患者从申请单到结算的全部操作</div>
        <div class="right">
          <el-select v-model="pid" filterable placeholder="选择患者（姓名 / 住院号）" style="width:250px" @change="onChange">
            <el-option v-for="p in patients" :key="p.patientId" :label="`${p.name}　${p.inpatientNo}`" :value="p.patientId" />
          </el-select>
          <el-button type="primary" :icon="Download" @click="exportDlg = true">导出轨迹</el-button>
        </div>
      </div>

      <template v-if="patient">
        <div class="money-grid" style="grid-template-columns:repeat(4,1fr)">
          <div class="money-card">
            <div class="k">累计操作</div>
            <div class="v" style="font-size:20px">{{ records.length }} <span class="tiny" style="font-weight:400">条</span></div>
          </div>
          <div class="money-card">
            <div class="k">当前状态</div>
            <div class="v" style="font-size:17px;margin-top:8px">
              <el-tag :type="PATIENT_STATUS[patient.status].type">{{ PATIENT_STATUS[patient.status].label }}</el-tag>
            </div>
          </div>
          <div class="money-card blue">
            <div class="k">账户余额</div>
            <div class="v" style="font-size:20px">¥{{ fmtAmount((account?.available || 0) + (account?.frozen || 0) + (account?.inpatientDeposit || 0)) }}</div>
          </div>
          <div class="money-card">
            <div class="k">最近变更</div>
            <div class="v" style="font-size:15px;font-weight:600">{{ records.length ? records[records.length - 1].time.slice(0, 16) : '—' }}</div>
          </div>
        </div>

        <div class="divider-h"></div>

        <el-timeline v-if="records.length" style="padding-left:6px;margin-top:6px">
          <el-timeline-item
            v-for="r in records"
            :key="r.seq"
            :timestamp="r.time"
            placement="top"
            :color="MODULE_COLOR[r.module] || '#718096'"
            size="normal"
          >
            <div style="font-size:12.5px">
              <span style="font-weight:700">{{ r.operator }}</span>
              <span class="muted"> · {{ r.role }}</span>
              <el-tag size="small" style="margin-left:8px" effect="plain">{{ MODULE_LABEL[r.module] }}</el-tag>
              <el-tag size="small" :type="ACTION_TYPE[r.action]" style="margin-left:6px">{{ ACTION_LABEL[r.action] }}</el-tag>
              <el-tag v-if="r.result === 'FAIL'" size="small" type="danger" style="margin-left:6px">失败</el-tag>
            </div>
            <div style="font-size:12.5px;color:#3d4759;margin-top:4px;line-height:1.75">
              {{ desc(r) }}
            </div>
            <div v-if="r.diff && r.diff.length" class="tiny" style="margin-top:2px">
              {{ r.diff.map((d) => `${d.label} ${d.from} → ${d.to}`).join(' · ') }}
            </div>
            <div class="tiny" style="margin-top:2px">对象：{{ r.targetType }} {{ r.targetId }}</div>
          </el-timeline-item>
        </el-timeline>
        <div v-else class="empty">
          <div class="big">—</div>
          该患者暂无操作记录
          <div class="tiny mt8">所有业务操作都会自动留痕</div>
        </div>

        <div class="divider-h"></div>
        <div class="tiny">
          共 {{ records.length }} 条记录 · 数据来源：本系统操作日志 · 与日志页同患者筛选结果一致
        </div>
      </template>
    </div>

    <el-dialog v-model="exportDlg" title="导出患者轨迹" width="440px">
      <el-form label-width="88px">
        <el-form-item label="导出用途" required>
          <el-select v-model="purpose" placeholder="请选择" style="width:100%">
            <el-option v-for="p in ['医疗质量检查', '纠纷举证', '内部审计', '其他']" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="hint-box info"><el-icon><InfoFilled /></el-icon>导出文件包含该患者全部业务节点、操作人、改前改后与校验码。</div>
      <template #footer>
        <el-button @click="exportDlg = false">取消</el-button>
        <el-button type="primary" @click="doExport">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { trace, get as getPatient } from '@/store/patients'
import { accountOf } from '@/store/accounts'
import { log } from '@/store/logs'
import { ACTION_LABEL, ACTION_TYPE, MODULE_LABEL, MODULE_COLOR } from '@/utils/audit'
import { fmtAmount } from '@/utils/format'
import { PATIENT_STATUS } from '@/mock/dict'

const route = useRoute()
const router = useRouter()
const pid = ref(route.params.patientId || state.patients[0]?.patientId || '')
const exportDlg = ref(false)
const purpose = ref('')

const patients = computed(() => state.patients)
const patient = computed(() => (pid.value ? getPatient(pid.value) : null))
const account = computed(() => (patient.value ? accountOf(patient.value.patientId) : null))
const records = computed(() => (pid.value ? trace(pid.value) : []))

function onChange(id) { router.replace('/trace/' + id) }

function desc(r) {
  const parts = []
  if (r.targetType) parts.push(`${r.targetType} ${r.targetId}`)
  if (r.after && typeof r.after === 'object') {
    parts.push(Object.entries(r.after).map(([k, v]) => `${k} ${v}`).join(' · '))
  }
  if (r.reason) parts.push(`原因：${r.reason}`)
  return parts.join(' ｜ ')
}

function doExport() {
  if (!purpose.value) return ElMessage.warning('请选择导出用途')
  ElMessage.success(`已导出 ${patient.value.name}-${patient.value.inpatientNo}-操作轨迹.pdf，共 ${records.value.length} 条（演示环境不生成文件）`)
  log({
    module: 'SYS', page: '患者轨迹', action: 'EXPORT', targetType: '患者轨迹',
    targetId: patient.value.inpatientNo, targetName: `${patient.value.name} ${patient.value.inpatientNo}`,
    patientId: patient.value.patientId, reason: `导出用途：${purpose.value}`
  })
  exportDlg.value = false
}
</script>
