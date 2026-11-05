<template>
  <div>
    <div class="notice-bar">
      <el-icon><InfoFilled /></el-icon>
      短信由医院统一消息网关发送，正文取自可自定义的「短信模板」，变量按患者与排程实时填充。模板修改会留痕，保存后立即生效，只影响之后发送的通知。
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">消息通知</div>
        <div class="card-sub">两类自动通知各有独立模板：预约成功、入院前提醒；通知只能由业务动作产生，页面不提供手写短信</div>
        <div class="right">
          <span class="muted">共 {{ base.length }} 条 · 待发送 {{ pendingCount }} 条 · 失败 {{ failedCount }} 条</span>
          <el-button v-if="can('msg.tpl')" type="primary" plain :icon="EditPen"
            @click="openTpl(tab === 'ALL' ? 'APPOINTMENT_SUCCESS' : tab)">短信模板配置</el-button>
        </div>
      </div>

      <el-tabs v-model="tab" class="msg-tabs">
        <el-tab-pane name="APPOINTMENT_SUCCESS">
          <template #label>
            预约通知
            <span v-if="stat('APPOINTMENT_SUCCESS').total" class="tab-badge">{{ stat('APPOINTMENT_SUCCESS').total }}</span>
          </template>
        </el-tab-pane>
        <el-tab-pane name="PRE_ADMISSION">
          <template #label>
            入院前通知
            <span v-if="stat('PRE_ADMISSION').pending" class="tab-badge warn">{{ stat('PRE_ADMISSION').pending }}</span>
          </template>
        </el-tab-pane>
        <el-tab-pane label="全部记录" name="ALL" />
      </el-tabs>

      <!-- ============ 业务通知面板 ============ -->
      <div v-if="tab !== 'ALL'" class="msg-layout">
        <div class="msg-main">
          <!-- 发送规则 / 任务配置 -->
          <div class="rule-bar">
            <div class="rb-grid">
              <template v-if="tab === 'PRE_ADMISSION'">
                <div class="rb-item"><span class="rb-k">提前天数</span>手术日前 <b>{{ noticeDays }}</b> 天</div>
                <div class="rb-item"><span class="rb-k">发送时间</span>当日 <b>09:00</b> 自动发送</div>
                <div class="rb-item"><span class="rb-k">通知范围</span>已排程未报到患者</div>
              </template>
              <template v-else>
                <div class="rb-item"><span class="rb-k">触发时机</span>创建手术预约（预约完成）时自动发送</div>
                <div class="rb-item">
                  <span class="rb-k">自动发送</span>
                  <el-tag size="small" :type="autoSend ? 'success' : 'info'">{{ autoSend ? '已开启' : '已关闭' }}</el-tag>
                </div>
                <div class="rb-item"><span class="rb-k">发送渠道</span>短信（医院统一网关）</div>
                <div class="rb-item"><span class="rb-k">今日已发</span><b>{{ stat('APPOINTMENT_SUCCESS').total }}</b> 条</div>
              </template>
            </div>
            <div class="rb-actions">
              <el-button v-if="tab === 'PRE_ADMISSION' && can('msg.send')" type="primary" :icon="Promotion"
                :disabled="!dueCount" @click="doRunDue">立即执行通知任务{{ dueCount ? '（' + dueCount + '）' : '' }}</el-button>
              <el-button v-if="can('param.save')" link type="primary" :icon="Setting" @click="goParam">参数配置</el-button>
            </div>
          </div>

          <!-- 短信内容预览 -->
          <div class="panel">
            <div class="panel-head">
              <div class="ph-title">
                短信内容预览
                <span class="ph-sub">模板：{{ tplName(tab) }}</span>
                <el-tag v-if="isCustomized(tab)" size="small" type="warning" effect="plain">已自定义</el-tag>
              </div>
              <div class="ph-right">
                <span class="tiny">{{ previewLen }} 字 · 按 {{ previewSms }} 条计费</span>
                <el-button v-if="can('msg.tpl')" link type="primary" :icon="EditPen" @click="openTpl(tab)">编辑模板</el-button>
              </div>
            </div>

            <div class="sms-wrap">
              <div class="sms-side">
                <div class="ss-k">示例患者</div>
                <div class="ss-name">{{ demo.name || '—' }}</div>
                <div class="tiny">{{ demo.dept || '' }} · {{ demo.inpatientNo || '' }}</div>
                <div class="ss-k mt10">接收号码</div>
                <div class="mono ss-phone">{{ demo.phone || '—' }}</div>
                <div class="ss-k mt10">模板状态</div>
                <div class="tiny">{{ versionText(tab) }}</div>
              </div>
              <div class="sms-bubble">{{ previewText }}</div>
            </div>

            <div class="sms-vars">
              模板变量：
              <span v-for="v in usedVars(tab)" :key="v" class="vchip">{{ '{' + v + '}' }}</span>
              <span class="tiny">发送时按患者与排程实时替换</span>
            </div>
          </div>

          <!-- 发送记录 -->
          <div class="panel">
            <div class="panel-head">
              <div class="ph-title">发送记录<span class="ph-sub">{{ tab === 'PRE_ADMISSION' ? '入院前提醒' : '预约成功通知' }}</span></div>
              <div class="ph-right tiny">
                共 {{ typeRows.length }} 条 · 成功 {{ stat(tab).sent }} · 待发 {{ stat(tab).pending }} · 失败 {{ stat(tab).failed }}
              </div>
            </div>
            <el-table :data="typeRows" size="small" border style="width:100%">
              <el-table-column label="发送时间" width="100">
                <template #default="{ row }">
                  <div class="num">{{ (row.sendTime || row.planSendTime || '').slice(5, 16) }}</div>
                  <div v-if="row.status === 'PENDING'" class="tiny">计划发送</div>
                </template>
              </el-table-column>
              <el-table-column label="患者" width="104">
                <template #default="{ row }">
                  <div>{{ pname(row.patientId) }}</div>
                  <div class="tiny mono">{{ pno(row.patientId) }}</div>
                </template>
              </el-table-column>
              <el-table-column label="科室 / 手术安排" width="168">
                <template #default="{ row }">
                  <div class="tiny">{{ schParts(row.patientId).date ? schParts(row.patientId).date + ' · ' : '' }}{{ pdept(row.patientId) }}</div>
                  <div class="tiny">{{ schParts(row.patientId).place }}</div>
                </template>
              </el-table-column>
              <el-table-column label="手机号" width="100">
                <template #default="{ row }"><span class="mono">{{ row.phone }}</span></template>
              </el-table-column>
              <el-table-column label="内容摘要" min-width="200">
                <template #default="{ row }">
                  <div class="sum-cell">
                    <span class="muted sum-text" :title="(row.content || '').replace(/\n/g, ' ')">{{ (row.content || '').replace(/\n/g, ' ') }}</span>
                    <el-button link type="primary" size="small" @click="openView(row)">查看</el-button>
                    <el-button v-if="row.status === 'FAILED' && can('msg.resend')" link type="danger" size="small" @click="doResend(row)">重发</el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="92" align="center">
                <template #default="{ row }">
                  <el-tooltip :disabled="row.status !== 'FAILED'" :content="row.failReason || '发送失败'">
                    <el-tag size="small" :type="STATUS_MAP[row.status].type">{{ STATUS_MAP[row.status].label }}</el-tag>
                  </el-tooltip>
                </template>
              </el-table-column>
              <template #empty><div class="empty">该类型暂无通知记录</div></template>
            </el-table>
          </div>
        </div>

        <aside class="msg-aside">
          <div class="panel">
            <div class="panel-head"><div class="ph-title">发送统计</div><div class="ph-right tiny">{{ today }}</div></div>
            <div class="stat-grid">
              <div class="stat-box ok"><b>{{ stat(tab).sent }}</b><span>已发送</span></div>
              <div class="stat-box wait"><b>{{ stat(tab).pending }}</b><span>待发送</span></div>
              <div class="stat-box bad"><b>{{ stat(tab).failed }}</b><span>失败</span></div>
            </div>
            <div class="tiny mt10">网关：医院统一消息平台。演示环境为模拟发送，不产生实际短信费用。</div>
          </div>

          <div class="panel">
            <div class="panel-head"><div class="ph-title">最近发送</div></div>
            <div class="mini-list">
              <div v-for="m in recent" :key="m.msgId" class="mini-item">
                <div class="mi-top">
                  <span class="mi-name">{{ pname(m.patientId) }}</span>
                  <el-tag size="small" :type="STATUS_MAP[m.status].type">{{ STATUS_MAP[m.status].label }}</el-tag>
                </div>
                <div class="tiny">{{ (m.sendTime || m.planSendTime || '').slice(5, 16) }} · <span class="mono">{{ m.phone }}</span></div>
              </div>
              <div v-if="!recent.length" class="empty">暂无记录</div>
            </div>
          </div>
        </aside>
      </div>

      <!-- ============ 全部记录 ============ -->
      <div v-else>
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
          <el-table-column label="发送时间" width="150">
            <template #default="{ row }">
              <span class="num">{{ (row.sendTime || row.planSendTime || '').slice(0, 16) }}</span>
              <div v-if="row.status === 'PENDING'" class="tiny">计划发送</div>
            </template>
          </el-table-column>
          <el-table-column label="患者" width="122">
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
          <el-table-column prop="channel" label="渠道" width="92" />
          <el-table-column label="接收号码" width="114">
            <template #default="{ row }"><span class="mono">{{ row.phone }}</span></template>
          </el-table-column>
          <el-table-column label="内容摘要" min-width="230">
            <template #default="{ row }">
              <span class="muted">{{ (row.content || '').replace(/\n/g, ' ').slice(0, 28) }}…</span>
              <el-button link type="primary" size="small" @click="openView(row)">查看</el-button>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="98" align="center">
            <template #default="{ row }">
              <el-tooltip :disabled="row.status !== 'FAILED'" :content="row.failReason || '发送失败'">
                <el-tag size="small" :type="STATUS_MAP[row.status].type">{{ STATUS_MAP[row.status].label }}</el-tag>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="82" align="center">
            <template #default="{ row }">
              <el-button v-if="row.status === 'FAILED' && can('msg.resend')" link type="danger" size="small" @click="doResend(row)">重发</el-button>
              <span v-else class="tiny">—</span>
            </template>
          </el-table-column>
          <template #empty><div class="empty">暂无通知记录</div></template>
        </el-table>
      </div>
    </div>

    <!-- ============ 模板编辑抽屉 ============ -->
    <el-drawer v-model="tplDlg" title="短信模板配置" size="680px">
      <div class="tpl-switch">
        <el-radio-group v-model="tplKey" size="small">
          <el-radio-button v-for="t in tplList" :key="t.key" :label="t.key">{{ t.name }}</el-radio-button>
        </el-radio-group>
      </div>

      <div class="tpl-meta">
        <el-tag size="small" :type="customized ? 'warning' : 'info'" effect="plain">{{ customized ? '已自定义' : '系统默认' }}</el-tag>
        <span class="tiny">{{ metaText }}</span>
      </div>

      <div class="tpl-label">可用变量<span class="tiny">（点击插入到光标位置）</span></div>
      <div class="var-list">
        <el-tooltip v-for="v in TPL_VARS" :key="v.key" :content="v.desc" placement="top">
          <span class="var-chip" @click="insertVar(v.key)">{{ '{' + v.key + '}' }}</span>
        </el-tooltip>
      </div>

      <div class="tpl-label mt12">短信正文</div>
      <el-input ref="tplInput" v-model="draft" type="textarea" :rows="11" :maxlength="TPL_MAX" show-word-limit
        placeholder="请输入短信正文，用 {患者姓名} 这样的占位符表示变量" />

      <div class="tpl-tip">
        <el-icon><InfoFilled /></el-icon>
        正文必须包含 {患者姓名}；只能使用上方列出的变量。一条短信按 70 字计费，超长会拆分为多条。
      </div>

      <div class="tpl-label mt12">发送效果预览<span class="tiny">（按示例患者实时渲染）</span></div>
      <div class="sms-bubble small">{{ draftPreview || '（正文为空）' }}</div>
      <div class="tiny mt8">{{ draft.length }} 字 · 按 {{ Math.max(1, Math.ceil(draft.length / 70)) }} 条计费</div>

      <div class="tpl-foot">
        <el-button @click="restoreTpl">恢复默认</el-button>
        <div style="flex:1"></div>
        <el-button @click="tplDlg = false">取消</el-button>
        <el-button type="primary" @click="saveTpl">保存并生效</el-button>
      </div>
    </el-drawer>

    <!-- ============ 通知内容抽屉 ============ -->
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
          <div class="k">短信条数</div><div class="v">{{ current.smsCount || 1 }} 条</div>
          <div class="k">重发次数</div><div class="v">{{ current.resendCount || 0 }}</div>
        </div>
        <div class="divider-h"></div>
        <div class="sms-bubble small">{{ current.content }}</div>
        <div class="divider-h"></div>
        <div class="kv">
          <div class="k">套用模板</div><div class="v">{{ tplName(current.tplKey || current.type) }}</div>
          <div class="k">触发动作</div><div class="v">{{ current.trigger }}</div>
          <div class="k">通知编号</div><div class="v mono">{{ current.msgId }}</div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshLeft, InfoFilled, EditPen, Promotion, Setting } from '@element-plus/icons-vue'
import { can } from '@/store/session'
import { state } from '@/store/db'
import { get as getPatient } from '@/store/patients'
import * as msg from '@/store/messages'
import * as tpl from '@/store/templates'

const TYPE_MAP = msg.TYPE_MAP
const STATUS_MAP = msg.STATUS_MAP
const TPL_VARS = tpl.TPL_VARS
const TPL_MAX = tpl.TPL_MAX

const router = useRouter()
const tab = ref('APPOINTMENT_SUCCESS')
const filters = reactive({ type: '', status: '', kw: '', range: [] })
const viewDlg = ref(false)
const current = ref(null)

const tplDlg = ref(false)
const tplKey = ref('APPOINTMENT_SUCCESS')
const draft = ref('')
const tplInput = ref(null)

const today = new Date().toISOString().slice(0, 10)
const noticeDays = computed(() => Number(state.settings.preAdmissionNoticeDays || 1))
const autoSend = computed(() => state.settings.autoSendAppointmentSms !== false)

const pname = (id) => getPatient(id)?.name || '—'
const pno = (id) => getPatient(id)?.inpatientNo || ''
const pdept = (id) => getPatient(id)?.dept || '—'

/** 示例患者：优先取当前有有效排程的，便于真实渲染预览 */
const demoId = computed(() => {
  const sch = state.schedules.find((s) => ['SCHEDULED', 'CHANGED'].includes(s.status))
  return sch?.patientId || state.patients[0]?.patientId || ''
})
const demo = computed(() => getPatient(demoId.value) || {})

const base = computed(() => state.messages.slice().sort((a, b) => {
  const ta = a.sendTime || a.planSendTime || ''
  const tb = b.sendTime || b.planSendTime || ''
  return ta < tb ? 1 : -1
}))
const pendingCount = computed(() => state.messages.filter((m) => m.status === 'PENDING').length)
const failedCount = computed(() => state.messages.filter((m) => m.status === 'FAILED').length)

const typeRows = computed(() => base.value.filter((m) => m.type === tab.value))
const recent = computed(() => base.value.filter((m) => m.type === tab.value).slice(0, 4))
const dueCount = computed(() => msg.dueList('PRE_ADMISSION').length)

function stat(type) {
  const list = state.messages.filter((m) => m.type === type)
  return {
    total: list.length,
    sent: list.filter((m) => m.status === 'SENT').length,
    pending: list.filter((m) => m.status === 'PENDING').length,
    failed: list.filter((m) => m.status === 'FAILED').length
  }
}

/* ---------- 模板预览 ---------- */
const tplName = (key) => tpl.get(key)?.name || tpl.TPL_LABEL[key] || '—'
const isCustomized = (key) => tpl.isCustomized(key)
const usedVars = (key) => tpl.varsIn(tpl.get(key)?.content || '')
const versionText = (key) => tpl.updatedText(key)
const previewText = computed(() => (tab.value === 'ALL' ? '' : tpl.preview(tab.value, demoId.value)))
const previewLen = computed(() => previewText.value.length)
const previewSms = computed(() => Math.max(1, Math.ceil(previewLen.value / 70)))

/** 排程摘要：日期 / 手术间 · 台次（分两行展示，窄列也不折行） */
function schParts(patientId) {
  const s = state.schedules.find((x) => x.patientId === patientId && ['SCHEDULED', 'CHANGED', 'CHECKED_IN', 'COMPLETED'].includes(x.status))
  if (!s) return { date: '—', place: '待排程' }
  return { date: (s.surgeryDate || '').slice(5), place: `${s.room} · 第 ${s.seq} 台` }
}

/* ---------- 模板编辑 ---------- */
const tplList = computed(() => tpl.list())
const curTpl = computed(() => tpl.get(tplKey.value))
const customized = computed(() => tpl.isCustomized(tplKey.value))
const metaText = computed(() => {
  const t = curTpl.value
  if (!t) return ''
  const v = '第 ' + (t.version || 1) + ' 版'
  return t.updatedAt ? `${v} · 上次修改 ${t.updatedAt} · ${t.updatedBy || ''}` : `${v} · 使用系统默认模板，尚未修改`
})
const draftPreview = computed(() => tpl.renderText(draft.value, tpl.buildVars(demoId.value)))

function openTpl(key) {
  if (!can('msg.tpl')) {
    ElMessage.warning('当前角色（' + state.session.roleLabel + '）无权修改短信模板')
    return
  }
  tplKey.value = key && key !== 'ALL' ? key : 'APPOINTMENT_SUCCESS'
  draft.value = tpl.get(tplKey.value)?.content || ''
  tplDlg.value = true
}

watch(tplKey, (k) => { draft.value = tpl.get(k)?.content || '' })

function insertVar(k) {
  const el = tplInput.value?.textarea
  const text = draft.value
  let s = text.length
  let e = text.length
  if (el && document.activeElement === el) {
    s = el.selectionStart ?? s
    e = el.selectionEnd ?? e
  }
  draft.value = text.slice(0, s) + '{' + k + '}' + text.slice(e)
  nextTick(() => {
    if (!el) return
    el.focus()
    const pos = s + k.length + 2
    el.setSelectionRange(pos, pos)
  })
}

function saveTpl() {
  try {
    tpl.save(tplKey.value, draft.value)
    ElMessage.success('模板已保存，之后发送的通知将使用新正文')
    tplDlg.value = false
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function restoreTpl() {
  ElMessageBox.confirm('恢复后当前自定义内容会被系统默认模板覆盖，确认继续？', '恢复默认模板', {
    type: 'warning', confirmButtonText: '恢复默认', cancelButtonText: '取消'
  }).then(() => {
    try {
      tpl.restore(tplKey.value)
      draft.value = tpl.get(tplKey.value).content
      ElMessage.success('已恢复系统默认模板')
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

/* ---------- 业务动作 ---------- */
const goParam = () => router.push('/param')

function doRunDue() {
  try {
    const n = msg.runDue('PRE_ADMISSION')
    if (n) ElMessage.success(`已发送 ${n} 条到点提醒`)
    else ElMessage.info('当前没有到发送时间的待发提醒')
  } catch (e) { ElMessage.error(e.message) }
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

/* ---------- 筛选（全部记录） ---------- */
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
</script>

<style scoped>
.sum-cell { display: flex; align-items: center; gap: 2px; min-width: 0; }
.sum-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sum-cell .el-button { flex-shrink: 0; }

.msg-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
.msg-main { min-width: 0; }
.msg-aside { display: flex; flex-direction: column; gap: 12px; }

.tab-badge {
  display: inline-block; min-width: 18px; height: 16px; line-height: 16px; padding: 0 5px;
  margin-left: 4px; border-radius: 8px; background: var(--brand-soft); color: var(--brand);
  font-size: 10.5px; text-align: center;
}
.tab-badge.warn { background: #fdf1e6; color: var(--warn); }

/* 规则条 */
.rule-bar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  background: #f7f9fc; border: 1px solid #e8eef7; border-radius: 8px;
  padding: 10px 14px; margin-bottom: 12px;
}
.rb-grid { display: flex; flex-wrap: wrap; gap: 8px 22px; flex: 1; min-width: 0; }
.rb-item { font-size: 12.5px; color: var(--ink-2); white-space: nowrap; }
.rb-k { color: var(--ink-3); margin-right: 6px; }
.rb-item b { color: var(--ink); font-weight: 600; }
.rb-item .warn-text, .warn-text { color: var(--warn); }
.rb-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

/* 面板 */
.panel { border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px 14px; margin-bottom: 12px; background: #fff; }
.panel-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.ph-title { font-size: 13px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; }
.ph-sub { font-size: 11.5px; font-weight: 400; color: var(--ink-3); }
.ph-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

/* 短信预览 */
.sms-wrap { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 14px; }
.sms-side { background: #f7f9fc; border: 1px solid #eef2f8; border-radius: 8px; padding: 10px 12px; }
.ss-k { font-size: 11px; color: var(--ink-3); }
.ss-name { font-size: 13px; font-weight: 600; margin: 2px 0 1px; }
.ss-phone { font-size: 12px; }
.sms-bubble {
  background: #fff; border: 1px solid #e2eaf5; border-left: 3px solid var(--brand);
  border-radius: 8px; padding: 12px 16px; font-size: 12.5px; line-height: 1.95;
  color: #2b3546; white-space: pre-wrap; word-break: break-word; min-height: 120px;
}
.sms-bubble.small { min-height: 0; padding: 10px 14px; line-height: 1.85; }
.sms-vars { margin-top: 10px; font-size: 11.5px; color: var(--ink-3); display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.vchip {
  display: inline-block; padding: 1px 6px; border-radius: 4px; background: var(--brand-soft);
  color: var(--brand); font-family: "Cascadia Mono", Consolas, monospace; font-size: 11px;
}

/* 统计 */
.stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat-box {
  border: 1px solid var(--line); border-radius: 8px; padding: 8px 6px; text-align: center;
  background: #fafbfd;
}
.stat-box b { display: block; font-size: 19px; line-height: 1.2; font-variant-numeric: tabular-nums; }
.stat-box span { font-size: 11px; color: var(--ink-3); }
.stat-box.ok b { color: var(--ok); }
.stat-box.wait b { color: var(--warn); }
.stat-box.bad b { color: var(--danger); }

.mini-list { display: flex; flex-direction: column; gap: 8px; }
.mini-item { border-bottom: 1px dashed var(--line); padding-bottom: 7px; }
.mini-item:last-child { border-bottom: 0; padding-bottom: 0; }
.mi-top { display: flex; align-items: center; justify-content: space-between; }
.mi-name { font-size: 12.5px; font-weight: 600; }

/* 模板抽屉 */
.tpl-switch { margin-bottom: 12px; }
.tpl-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.tpl-label { font-size: 12.5px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
.tpl-label .tiny { font-weight: 400; }
.var-list { display: flex; flex-wrap: wrap; gap: 6px; }
.var-chip {
  cursor: pointer; padding: 2px 8px; border: 1px dashed #c2d6e9; border-radius: 12px;
  background: #f7fbff; color: var(--brand); font-size: 11.5px;
  font-family: "Cascadia Mono", Consolas, monospace; transition: all .15s;
}
.var-chip:hover { background: var(--brand); color: #fff; border-color: var(--brand); }
.tpl-tip {
  display: flex; align-items: flex-start; gap: 6px; margin-top: 8px;
  font-size: 11.5px; color: var(--ink-3); line-height: 1.7;
}
.tpl-tip .el-icon { color: var(--brand); margin-top: 2px; }
.tpl-foot { display: flex; align-items: center; gap: 8px; margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--line); }
.mt8 { margin-top: 8px; }
.mt10 { margin-top: 10px; }
.mt12 { margin-top: 12px; }
</style>
