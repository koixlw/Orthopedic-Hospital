<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">转普通入院</div>
        <div class="card-sub">先查患者、再办转院：查询患者信息确认无误后，进入转普通住院操作页</div>
      </div>

      <div class="toolbar">
        <el-input v-model="kw" placeholder="住院号 / 姓名 / 申请单号" clearable :prefix-icon="Search" style="width:240px"
          @keyup.enter="doQuery" />
        <el-button type="primary" :icon="Search" @click="doQuery">查询</el-button>
        <el-button :icon="Connection" @click="doSync">HIS 系统同步</el-button>
        <el-button :icon="Postcard" @click="doCard">刷就诊卡</el-button>
        <el-select v-model="filterStatus" placeholder="患者状态" clearable style="width:150px">
          <el-option v-for="(v, k) in PATIENT_STATUS" :key="k" :label="v.label" :value="k" />
        </el-select>
        <el-button :icon="RefreshLeft" @click="resetFilters">清空筛选</el-button>
        <span class="muted" style="margin-left:auto">共 {{ rows.length }} 条</span>
      </div>

      <div class="hint-box info" style="margin-bottom:10px">
        <el-icon><InfoFilled /></el-icon>
        <div>
          「HIS 系统同步」按住院号读取 HIS 患者档案与住院证；「刷就诊卡」读取医保卡 / 就诊卡定位患者。
          两者均只读、不回写，命中本系统患者后方可进入转普通住院操作页。
        </div>
      </div>

      <el-table :data="rows" size="small" border style="width:100%" row-key="patientId">
        <el-table-column label="患者" width="126">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div class="tiny mono">{{ row.inpatientNo }}</div>
          </template>
        </el-table-column>
        <el-table-column label="性别/年龄" width="86">
          <template #default="{ row }">{{ row.gender }} / {{ row.age }}</template>
        </el-table-column>
        <el-table-column prop="dept" label="科室" width="104" />
        <el-table-column prop="surgeryName" label="手术名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="拟手术日" width="98">
          <template #default="{ row }"><span class="num">{{ row.plannedSurgeryDate || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="患者状态" width="94" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="PATIENT_STATUS[row.status].type">{{ PATIENT_STATUS[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评估状态" width="98" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="evalOf(row).type" effect="plain">{{ evalOf(row).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="储值金" width="106" align="center">
          <template #default="{ row }">
            <el-tag v-if="accOf(row.patientId)" size="small" :type="accTag(row)" effect="plain">{{ accLabel(row) }}</el-tag>
            <span v-else class="muted">未开户</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="!canTransfer(row)"
              :title="canTransfer(row) ? '' : '仅「已入院 / 术中 / 普通住院」状态可办理'"
              @click="go(row)"
            >转普通住院</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty">
            <div class="big">—</div>
            未查询到符合条件的患者
            <div class="mt8 tiny">可尝试「HIS 系统同步」按住院号读取，或「刷就诊卡」定位患者</div>
          </div>
        </template>
      </el-table>
    </div>

    <!-- HIS 同步 / 就诊卡读取结果 -->
    <el-drawer v-model="archiveDlg" title="HIS 患者档案" size="560px">
      <template v-if="archive">
        <div class="hint-box info" style="margin-bottom:12px">
          <el-icon><InfoFilled /></el-icon>
          <div>来源：{{ archive.source }} · 读取时间 {{ archive.readAt }}</div>
        </div>
        <div class="section-h">患者信息</div>
        <div class="kv" style="grid-template-columns:96px 1fr 96px 1fr">
          <div class="k">姓名</div><div class="v">{{ archive.patient.name }}</div>
          <div class="k">性别/年龄</div><div class="v">{{ archive.patient.gender }} / {{ archive.patient.age }}</div>
          <div class="k">住院号</div><div class="v mono">{{ archive.patient.inpatientNo }}</div>
          <div class="k">就诊科室</div><div class="v">{{ archive.patient.dept }}</div>
          <div class="k">身份证号</div><div class="v mono">{{ archive.patient.idCard }}</div>
          <div class="k">联系电话</div><div class="v">{{ archive.patient.phone || '—' }}</div>
          <div class="k">过敏史</div>
          <div class="v" :class="archive.patient.allergy && archive.patient.allergy !== '无' ? 'amount-red' : ''">
            {{ archive.patient.allergy || '未提供' }}
          </div>
        </div>
        <div class="section-h mt16">住院证</div>
        <div class="kv" style="grid-template-columns:96px 1fr 96px 1fr">
          <div class="k">住院证号</div><div class="v mono">{{ archive.admissionCert.admissionCertNo }}</div>
          <div class="k">拟手术日</div><div class="v num">{{ archive.admissionCert.plannedSurgeryDate }}</div>
          <div class="k">手术名称</div><div class="v">{{ archive.admissionCert.surgeryName }}</div>
          <div class="k">主刀医师</div><div class="v">{{ archive.admissionCert.surgeon }}</div>
          <div class="k">手术间</div><div class="v">{{ archive.admissionCert.surgeryRoom || '—' }}</div>
          <div class="k">诊断</div><div class="v">{{ archive.admissionCert.diagnosis || '—' }}</div>
        </div>
        <div class="section-h mt16">术前检查报告（{{ archive.reports.length }} 项）</div>
        <el-table :data="archive.reports" size="small" border>
          <el-table-column prop="reportName" label="报告名称" />
          <el-table-column label="报告时间" width="150">
            <template #default="{ row }"><span class="num">{{ (row.reportTime || '').slice(0, 16) }}</span></template>
          </el-table-column>
          <el-table-column prop="source" label="来源" width="70" />
          <template #empty><div class="empty">暂无报告</div></template>
        </el-table>
        <div class="flex mt16" style="justify-content:flex-end">
          <el-button @click="archiveDlg = false">关闭</el-button>
          <el-button v-if="archivePatient" type="primary" @click="go(archivePatient)">进入转普通住院操作页</el-button>
          <el-button v-else disabled>该患者尚未在本系统建档</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Connection, Postcard, RefreshLeft, InfoFilled } from '@element-plus/icons-vue'
import { state } from '@/store/db'
import { accountOf } from '@/store/patients'
import { evalSummary } from '@/utils/guard'
import { fetchPatientArchive } from '@/api/his'
import { PATIENT_STATUS, ACCOUNT_STATUS } from '@/mock/dict'

const router = useRouter()
const kw = ref('')
const filterStatus = ref('')
const archiveDlg = ref(false)
const archive = ref(null)
const archivePatient = ref(null)

const TRANSFERABLE = ['ADMITTED', 'IN_SURGERY', 'TRANSFERRED']

const rows = computed(() => state.patients.filter((p) => {
  const k = kw.value.trim()
  if (k) {
    const hit = p.name.includes(k) || p.inpatientNo.includes(k) ||
      state.applies.some((a) => a.patientId === p.patientId && a.applyNo === k)
    if (!hit) return false
  }
  if (filterStatus.value && p.status !== filterStatus.value) return false
  return true
}))

const evalOf = (p) => evalSummary(p)
const accOf = (pid) => accountOf(pid)
const accTag = (p) => ACCOUNT_STATUS[accountOf(p.patientId)?.status]?.type || 'info'
const accLabel = (p) => ACCOUNT_STATUS[accountOf(p.patientId)?.status]?.label || '—'
const canTransfer = (p) => TRANSFERABLE.includes(p.status)

function go(row) {
  router.push('/transfer/' + row.patientId)
}

function doQuery() {
  const k = kw.value.trim()
  if (!k) {
    filterStatus.value = ''
    ElMessage.info('已显示全部日间手术患者')
    return
  }
  const hit = rows.value.length
  if (!hit) ElMessage.warning('未查询到该患者，请确认住院号、姓名或申请单号')
}

function resetFilters() {
  kw.value = ''
  filterStatus.value = ''
}

/** HIS 系统同步：按住院号读取 HIS 患者档案 */
async function doSync() {
  const no = kw.value.trim()
  if (!no) return ElMessage.warning('请先输入住院号，再执行 HIS 系统同步')
  try {
    const res = await fetchPatientArchive(no)
    archive.value = { ...res, source: 'HIS 住院证接口（模拟）' }
    archivePatient.value = state.patients.find((p) => p.inpatientNo === no) || null
    archiveDlg.value = true
    ElMessage.success('已从 HIS 同步到患者档案')
  } catch (e) {
    ElMessage.error(e.message)
  }
}

/** 刷就诊卡：读取医保卡 / 就诊卡定位患者 */
async function doCard() {
  const candidates = state.patients.filter((p) => TRANSFERABLE.includes(p.status))
  const p = candidates[0]
  if (!p) return ElMessage.warning('当前没有可办理转普通入院的患者')
  kw.value = p.inpatientNo
  try {
    const res = await fetchPatientArchive(p.inpatientNo)
    archive.value = { ...res, source: '医保卡 / 就诊卡接口（模拟）' }
    archivePatient.value = p
    archiveDlg.value = true
    ElMessage.success(`已读取就诊卡：${p.name} ${p.inpatientNo}`)
  } catch (e) {
    ElMessage.error(e.message)
  }
}
</script>
