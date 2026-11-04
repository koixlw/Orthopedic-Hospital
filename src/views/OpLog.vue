<template>
  <div>
    <div class="notice-bar">
      <el-icon><Lock /></el-icon>
      操作日志为只追加记录，<b>仅支持追加，不支持修改</b>，保留期限不少于 3 年；可按患者维度导出完整轨迹。
    </div>

    <div v-if="overflow" class="notice-bar warn">
      <el-icon><Warning /></el-icon>
      演示环境日志已达上限（2000 条），请重置演示数据。
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">操作日志</div>
        <div class="card-sub">
          共 {{ total }} 条 · 今日 {{ todayCount }} 条 ·
          <span :style="{ color: failCount ? '#c05621' : '#8a94a6', cursor: failCount ? 'pointer' : 'default' }"
            @click="failCount && (filters.result = 'FAIL')">失败 {{ failCount }} 条</span>
        </div>
        <div class="right">
          <el-button :icon="Download" @click="exportDlg = true">导出</el-button>
          <el-button :icon="Position" @click="$router.push('/trace')">查看患者轨迹</el-button>
        </div>
      </div>

      <div class="toolbar">
        <el-select v-model="filters.module" placeholder="模块" clearable style="width:130px">
          <el-option v-for="(v, k) in MODULE_LABEL" :key="k" :label="v" :value="k" />
        </el-select>
        <el-select v-model="filters.action" placeholder="动作" clearable style="width:120px">
          <el-option v-for="(v, k) in ACTION_LABEL" :key="k" :label="v" :value="k" />
        </el-select>
        <el-select v-model="filters.operator" placeholder="操作人" clearable style="width:120px">
          <el-option v-for="o in operators" :key="o" :label="o" :value="o" />
        </el-select>
        <el-date-picker v-model="filters.range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" style="width:230px" />
        <el-input v-model="filters.kw" placeholder="对象名 / 单号" clearable :prefix-icon="Search" style="width:180px" />
        <el-button type="primary" @click="noop">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>

      <el-table :data="rows" size="small" border style="width:100%" row-key="seq" :row-style="{ height: '44px' }">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-box">
              <div class="expand-title">变更详情</div>
              <table v-if="row.diff && row.diff.length" class="diff-table">
                <thead><tr><th style="width:180px">字段</th><th>改前</th><th>改后</th></tr></thead>
                <tbody>
                  <tr v-for="d in row.diff" :key="d.field">
                    <td>{{ d.label }}</td><td class="before">{{ d.from }}</td><td class="after">{{ d.to }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else-if="row.before" class="diff-table-simple">
                <div><span class="k">改前</span>{{ brief(row.before) }}</div>
                <div><span class="k">改后</span>{{ brief(row.after) }}</div>
              </div>
              <div v-else class="diff-table-simple">
                <div><span class="k">新增内容</span>{{ brief(row.after) }}</div>
              </div>
              <div class="expand-meta">
                <div><span class="k">操作原因</span>{{ row.reason || '—' }}</div>
                <div><span class="k">所在页面</span>{{ MODULE_LABEL[row.module] }} › {{ row.page }}</div>
                <div><span class="k">终端</span>{{ row.client }}</div>
                <div><span class="k">对象</span>{{ row.targetType }} {{ row.targetId }}（{{ row.targetName }}）</div>
                <div v-if="row.result === 'FAIL'"><span class="k">失败原因</span><span class="amount-red">{{ row.failReason }}</span></div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="seq" label="序号" width="70">
          <template #default="{ row }"><span class="mono">{{ row.seq }}</span></template>
        </el-table-column>
        <el-table-column prop="time" label="时间" width="158">
          <template #default="{ row }"><span class="num">{{ row.time }}</span></template>
        </el-table-column>
        <el-table-column label="操作人" width="106">
          <template #default="{ row }">
            <div>{{ row.operator }}</div>
            <div class="tiny">{{ row.role }}</div>
          </template>
        </el-table-column>
        <el-table-column label="模块" width="90">
          <template #default="{ row }">{{ MODULE_LABEL[row.module] || row.module }}</template>
        </el-table-column>
        <el-table-column label="动作" width="88" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="ACTION_TYPE[row.action]">{{ ACTION_LABEL[row.action] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="对象" width="176">
          <template #default="{ row }">
            <div>{{ row.targetName }}</div>
            <div class="tiny mono">{{ row.targetId }}</div>
          </template>
        </el-table-column>
        <el-table-column label="变更摘要" min-width="200">
          <template #default="{ row }">
            <template v-if="row.diff && row.diff.length">
              <span class="muted">
                {{ row.diff[0].label }} {{ row.diff[0].from }} → {{ row.diff[0].to }}
                <template v-if="row.diff.length > 1"> 等 {{ row.diff.length }} 项</template>
              </span>
            </template>
            <span v-else class="muted">{{ row.reason || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="80" align="center">
          <template #default="{ row }">
            <el-tooltip :disabled="row.result !== 'FAIL'" :content="row.failReason">
              <span :style="{ color: row.result === 'FAIL' ? '#c53030' : '#2f855a' }">{{ row.result === 'FAIL' ? '失败' : '成功' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="校验码" width="96">
          <template #default="{ row }"><span class="mono tiny">{{ row.chain }}</span></template>
        </el-table-column>
        <template #empty><div class="empty">没有符合条件的日志</div></template>
      </el-table>
    </div>

    <el-dialog v-model="exportDlg" title="导出操作日志" width="440px">
      <el-form label-width="88px">
        <el-form-item label="导出用途" required>
          <el-select v-model="exportPurpose" placeholder="请选择" style="width:100%">
            <el-option v-for="p in ['医疗质量检查', '纠纷举证', '内部审计', '其他']" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="hint-box info"><el-icon><InfoFilled /></el-icon>导出将记录操作人、时间与用途，导出行为本身也写入日志。</div>
      <template #footer>
        <el-button @click="exportDlg = false">取消</el-button>
        <el-button type="primary" @click="doExport">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Search, Position, Warning } from '@element-plus/icons-vue'
import * as logStore from '@/store/logs'
import { ACTION_LABEL, ACTION_TYPE, MODULE_LABEL } from '@/utils/audit'
import { state } from '@/store/db'
import { log } from '@/store/logs'

const filters = reactive({ module: '', action: '', operator: '', range: [], kw: '', result: '' })
const exportDlg = ref(false)
const exportPurpose = ref('')

const overflow = computed(() => logStore.overflow.value)
const total = computed(() => logStore.total.value)
const rows = computed(() => logStore.query({ ...filters }))
const operators = computed(() => [...new Set(state.logs.list.map((l) => l.operator))])
const todayCount = computed(() => state.logs.list.filter((l) => l.time.slice(0, 10) === new Date().toISOString().slice(0, 10)).length)
const failCount = computed(() => state.logs.list.filter((l) => l.result === 'FAIL').length)

function reset() {
  Object.assign(filters, { module: '', action: '', operator: '', range: [], kw: '', result: '' })
}
function noop() {}
function brief(obj) {
  if (!obj) return '—'
  return Object.entries(obj).map(([k, v]) => `${k}：${v}`).join('　')
}

function doExport() {
  if (!exportPurpose.value) return ElMessage.warning('请选择导出用途')
  ElMessage.success(`已导出 操作日志.xlsx，共 ${rows.value.length} 条（演示环境不生成文件）`)
  log({
    module: 'SYS', page: '操作日志', action: 'EXPORT', targetType: '操作日志',
    targetId: 'LOG_EXPORT', targetName: `操作日志（${rows.value.length} 条）`,
    reason: `导出用途：${exportPurpose.value}`
  })
  exportDlg.value = false
}
</script>

<style scoped>
.expand-box { padding: 12px 16px 14px 44px; background: #fbfcfe; }
.expand-title { font-size: 12px; font-weight: 700; color: #46536a; margin-bottom: 8px; }
.diff-table { width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; }
.diff-table th { background: #f2f5f9; color: #5b6678; font-weight: 600; text-align: left; padding: 6px 10px; border: 1px solid #e8edf4; }
.diff-table td { padding: 6px 10px; border: 1px solid #e8edf4; }
.diff-table td.before { color: #8a5a1f; }
.diff-table td.after { color: #2f6750; font-weight: 600; }
.diff-table-simple { font-size: 12px; line-height: 1.9; background: #fff; border: 1px solid #e8edf4; padding: 8px 10px; }
.diff-table-simple .k { color: #8a94a6; margin-right: 10px; }
.expand-meta { margin-top: 10px; font-size: 12px; color: #4b5563; line-height: 1.9; }
.expand-meta .k { color: #8a94a6; display: inline-block; width: 70px; }
</style>
