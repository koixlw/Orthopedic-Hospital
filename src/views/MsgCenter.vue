<template>
  <div>
    <div class="notice-bar">
      <el-icon><InfoFilled /></el-icon>
      短信由医院统一消息网关发送，本页记录发送结果并支持重发。演示环境不真实发送，状态为模拟。
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">消息通知</div>
        <div class="card-sub">通知只能由业务动作产生，页面不提供新建与编辑入口</div>
        <div class="right">
          <span class="muted">共 {{ rows.length }} 条 · 待发送 {{ pendingCount }} 条 · 发送失败 {{ failedCount }} 条</span>
        </div>
      </div>

      <div class="toolbar">
        <el-select v-model="filters.type" placeholder="通知类型" clearable style="width:150px">
          <el-option v-for="(v, k) in TYPE_MAP" :key="k" :label="v.label" :value="k" />
        </el-select>
        <el-select v-model="filters.status" placeholder="发送状态" clearable style="width:140px">
          <el-option v-for="(v, k) in STATUS_MAP" :key="k" :label="v.label" :value="k" />
        </el-select>
        <el-input v-model="filters.kw" placeholder="患者姓名 / 住院号 / 内容" clearable :prefix-icon="Search" style="width:230px" />
        <el-date-picker v-model="filters.range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:240px" />
        <el-button :icon="RefreshLeft" @click="reset">重置</el-button>
      </div>

      <el-table :data="rows" size="small" border style="width:100%">
        <el-table-column label="发送时间" width="156">
          <template #default="{ row }">
            <span class="num">{{ (row.sendTime || row.planSendTime || '').slice(0, 16) }}</span>
            <div v-if="row.status === 'PENDING'" class="tiny">计划发送</div>
          </template>
        </el-table-column>
        <el-table-column label="患者" width="128">
          <template #default="{ row }">
            <div>{{ pname(row.patientId) }}</div>
            <div class="tiny mono">{{ pno(row.patientId) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="112">
          <template #default="{ row }">
            <el-tag size="small" :type="TYPE_MAP[row.type].type">{{ TYPE_MAP[row.type].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="96" />
        <el-table-column label="接收号码" width="118">
          <template #default="{ row }"><span class="mono">{{ row.phone }}</span></template>
        </el-table-column>
        <el-table-column label="内容摘要" min-width="240">
          <template #default="{ row }">
            <span class="muted">{{ (row.content || '').slice(0, 34) }}…</span>
            <el-button link type="primary" size="small" @click="openView(row)">查看</el-button>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tooltip :disabled="row.status !== 'FAILED'" :content="row.failReason || '发送失败'">
              <el-tag size="small" :type="STATUS_MAP[row.status].type">{{ STATUS_MAP[row.status].label }}</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="92" align="center">
          <template #default="{ row }">
            <el-button v-if="row.status === 'FAILED'" link type="danger" size="small" @click="doResend(row)">重发</el-button>
            <span v-else class="tiny">—</span>
          </template>
        </el-table-column>
        <template #empty><div class="empty">暂无通知记录</div></template>
      </el-table>
    </div>

    <el-drawer v-model="viewDlg" title="通知内容" size="520px">
      <template v-if="current">
        <div class="kv">
          <div class="k">收件人</div><div class="v">{{ pname(current.patientId) }} <span class="mono">{{ current.phone }}</span></div>
          <div class="k">类型</div><div class="v">{{ TYPE_MAP[current.type].label }}</div>
          <div class="k">渠道</div><div class="v">{{ current.channel }}</div>
          <div class="k">状态</div>
          <div class="v">
            <el-tag size="small" :type="STATUS_MAP[current.status].type">{{ STATUS_MAP[current.status].label }}</el-tag>
            <span class="tiny" style="margin-left:8px">{{ current.sendTime || '计划 ' + current.planSendTime }}</span>
          </div>
          <div class="k">重发次数</div><div class="v">{{ current.resendCount || 0 }}</div>
        </div>
        <div class="divider-h"></div>
        <div class="sms-box">{{ current.content }}</div>
        <div class="divider-h"></div>
        <div class="kv">
          <div class="k">触发动作</div><div class="v">{{ current.trigger }}</div>
          <div class="k">通知编号</div><div class="v mono">{{ current.msgId }}</div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshLeft } from '@element-plus/icons-vue'
import { get as getPatient } from '@/store/patients'
import * as msg from '@/store/messages'

const TYPE_MAP = msg.TYPE_MAP
const STATUS_MAP = msg.STATUS_MAP

const filters = reactive({ type: '', status: '', kw: '', range: [] })
const viewDlg = ref(false)
const current = ref(null)

const pname = (id) => getPatient(id)?.name || '—'
const pno = (id) => getPatient(id)?.inpatientNo || ''

const base = computed(() => msg.all.value.slice().sort((a, b) => {
  const ta = a.sendTime || a.planSendTime || ''
  const tb = b.sendTime || b.planSendTime || ''
  return ta < tb ? 1 : -1
}))
const pendingCount = computed(() => msg.all.value.filter((m) => m.status === 'PENDING').length)
const failedCount = computed(() => msg.all.value.filter((m) => m.status === 'FAILED').length)

const rows = computed(() => base.value
  .filter((m) => !filters.type || m.type === filters.type)
  .filter((m) => !filters.status || m.status === filters.status)
  .filter((m) => {
    const kw = filters.kw.trim()
    if (!kw) return true
    return pname(m.patientId).includes(kw) || pno(m.patientId).includes(kw) || (m.content || '').includes(kw)
  })
  .filter((m) => {
    if (!filters.range || filters.range.length !== 2) return true
    const t = (m.sendTime || m.planSendTime || '').slice(0, 10)
    return t >= filters.range[0] && t <= filters.range[1]
  }))

function reset() {
  filters.type = ''
  filters.status = ''
  filters.kw = ''
  filters.range = []
}

function openView(row) {
  current.value = row
  viewDlg.value = true
}

function doResend(row) {
  ElMessageBox.confirm(`确认重新发送给 ${pname(row.patientId)}（${row.phone}）？`, '重发通知', {
    type: 'warning', confirmButtonText: '确认重发', cancelButtonText: '取消'
  }).then(() => {
    try {
      const m = msg.resend(row.msgId)
      ElMessage.success(`已重新发送（第 ${m.resendCount} 次）`)
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}
</script>

<style scoped>
.sms-box {
  background: #f7f9fc; border: 1px solid #e8eef7; border-radius: 8px; padding: 14px;
  font-size: 12.5px; line-height: 1.9; color: #2b3546; white-space: pre-wrap;
}
</style>
