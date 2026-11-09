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
        <el-checkbox v-model="form.isVerbal" label="口头医嘱" style="margin-left:12px" />
        <span class="tiny">医嘱类型决定可否停嘱：长期医嘱可停嘱，临时医嘱一次执行</span>
      </div>

      <div class="entry-row">
        <div class="fld" style="flex:1.4">
          <div class="lb">药品</div>
          <el-select v-model="form.drugName" filterable :filter-method="filterDrug" placeholder="输入中文或拼音首字母，如 bbf"
            popper-class="spec-popper" style="width:100%" @change="onDrugName">
            <el-option v-for="d in drugNames" :key="d.name" :label="d.name" :value="d.name">
              <span>{{ d.name }}</span>
              <span class="tiny opt-tail">{{ enabledSpecs(d).length }} 个规格</span>
            </el-option>
          </el-select>
        </div>
        <div class="fld" style="width:148px">
          <div class="lb">规格</div>
          <el-select v-model="form.drugCode" placeholder="先选药品" :disabled="!form.drugName" popper-class="spec-popper"
            style="width:100%" @change="onSpec">
            <el-option v-for="s in specOptions" :key="s.code" :label="s.spec" :value="s.code" :disabled="!s.enabled">
              <span>{{ s.spec }}</span>
              <span class="tiny opt-tail">{{ s.enabled ? s.dose + s.unit : '已停用' }}</span>
            </el-option>
          </el-select>
        </div>
        <div class="fld" style="width:104px">
          <div class="lb">剂量</div>
          <el-input-number v-model="form.dose" :min="0" :precision="2" controls-position="right" style="width:100%" />
        </div>
        <div class="fld" style="width:96px">
          <div class="lb">单位</div>
          <el-select v-model="form.unit" placeholder="选择单位" :disabled="!form.drugCode" style="width:100%">
            <el-option v-for="u in unitOptions" :key="u" :label="u" :value="u" />
          </el-select>
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
        <div class="fld" style="width:150px">
          <div class="lb">备注（选填）</div>
          <el-input v-model="form.remark" maxlength="50" placeholder="如：术中分次给药" clearable />
        </div>
        <div class="fld" style="width:96px">
          <div class="lb">&nbsp;</div>
          <el-button v-if="can('ord.add')" type="primary" style="width:100%" @click="doAdd">添加医嘱</el-button>
        </div>
      </div>

      <div class="tiny muted mt8">
        规格与单位取自药品字典：选定药品后可在「规格」中切换包装规格，剂量单位、默认剂量与用法随之刷新；已停用规格灰显不可选。
      </div>

      <!-- 口头医嘱填写框：医师口述、护士复述，复述人与复述时间一并留痕 -->
      <div v-if="form.isVerbal" class="entry-row verbal-row mt8">
        <div class="fld" style="width:160px">
          <div class="lb">复述人</div>
          <el-input v-model="form.reciter" placeholder="复述护士姓名" />
        </div>
        <div class="fld" style="width:190px">
          <div class="lb">复述时间</div>
          <el-date-picker v-model="form.reciteTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm" placeholder="选择复述时间" style="width:100%" />
        </div>
        <div class="fld" style="flex:1;min-width:220px">
          <div class="lb">下达情形说明（选填）</div>
          <el-input v-model="form.verbalNote" maxlength="100" placeholder="如：手术台上口述，无法立即书写" />
        </div>
        <div class="fld" style="width:300px">
          <div class="lb">&nbsp;</div>
          <div class="tiny" style="line-height:32px">口头医嘱须由护士复述并记录复述人后方可提交</div>
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
          <el-option label="待提交" value="待提交" />
          <el-option label="未执行" value="未执行" />
          <el-option label="执行中" value="执行中" />
          <el-option label="已执行" value="已执行" />
          <el-option label="已停止" value="已停止" />
          <el-option label="已作废" value="已作废" />
        </el-select>
        <el-input v-model="filter.kw" placeholder="药品名称" clearable size="small" :prefix-icon="Search" style="width:160px" />
        <el-switch v-model="showRemoved" size="small" active-text="显示已移除" style="margin-left:auto" />
      </div>

      <div class="flex gap12 mt12" style="justify-content:space-between;align-items:center">
        <span class="tiny">
          待提交 <b class="num">{{ pendingCount }}</b> 条 ｜ 已提交 <b class="num">{{ submittedCount }}</b> 条
          ｜ 麻醉药 <b class="num">{{ anestheticCount }}</b> 条 ｜ 执行中 <b class="num">{{ activeCount }}</b> 条
          <span class="muted">　新增医嘱先进入「待提交」，确认无误后一次性提交</span>
        </span>
        <el-button
          v-if="can('ord.submit')"
          type="primary"
          :disabled="!pendingCount"
          @click="doSubmitOrders"
        >一次性提交医嘱（{{ pendingCount }}）</el-button>
      </div>

      <el-table :data="rows" size="small" border style="width:100%" :row-class-name="rowClass">
        <el-table-column label="类型" width="72" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.type === '长期' ? 'primary' : 'info'" effect="plain">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="药品" min-width="200">
          <template #default="{ row }">
            <div class="flex gap6" style="align-items:center;min-width:0">
              <span
                :class="{ strike: row.removed || row.execStatus === '已作废' }"
                style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                :title="row.drugName"
              >{{ row.drugName }}</span>
              <el-tag v-if="row.isAnesthetic" size="small" type="danger" effect="dark" style="flex:none">麻醉</el-tag>
              <el-tag v-if="row.isVerbal" size="small" type="warning" effect="dark" style="flex:none">口头</el-tag>
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
        <el-table-column label="口头医嘱复述" width="146">
          <template #default="{ row }">
            <template v-if="row.isVerbal">
              <div>{{ row.reciter || '—' }}</div>
              <div class="tiny num">{{ (row.reciteTime || '').slice(0, 16) || '—' }}</div>
            </template>
            <span v-else class="tiny muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.remark" class="tiny" :title="row.remark">{{ row.remark }}</span>
            <span v-else class="tiny muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="doctor" label="开嘱医师" width="72" />
        <el-table-column label="状态" width="92" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="stTag(row)">{{ row.execStatus }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <template v-if="row.execStatus === '待提交' && !row.removed">
              <el-button v-if="can('ord.add')" link type="primary" size="small" @click="openEdit(row)">修改</el-button>
              <el-button v-if="can('ord.remove')" link type="danger" size="small" @click="doRemove(row)">移除</el-button>
            </template>
            <template v-else-if="row.execStatus === '执行中' && !row.removed">
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
          <div>新增医嘱先落为<b>待提交</b>记录，可在操作栏移除；确认无误后点击「一次性提交医嘱」全部提交。</div>
          <div><b>规格</b>与<b>剂量单位</b>取自药品字典：同一药品的不同包装规格在「规格」中切换，切换后单位、默认剂量自动带出；已停用规格不可选。</div>
          <div><b>口头医嘱</b>须由护士复述并记录复述人与复述时间，未填复述信息不能提交。</div>
          <div><b>临时医嘱</b>一次执行，不可停嘱；<b>长期医嘱</b>可停嘱，停嘱后保留记录与停嘱时间。</div>
        <div>每条医嘱可填写<b>备注</b>（录入时选填，执行中可在「修改」里补充），用于记录术中特殊交代。</div>
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
          <el-form-item label="规格">
            <el-select v-model="editForm.drugCode" popper-class="spec-popper" style="width:100%" @change="onEditSpec">
              <el-option v-for="s in editSpecs" :key="s.code" :label="s.spec" :value="s.code" :disabled="!s.enabled">
                <span>{{ s.spec }}</span>
                <span class="tiny opt-tail">{{ s.enabled ? s.dose + s.unit : '已停用' }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="剂量">
            <el-input-number v-model="editForm.dose" :min="0" :precision="2" style="width:100%" />
          </el-form-item>
          <el-form-item label="单位">
            <el-select v-model="editForm.unit" style="width:100%">
              <el-option v-for="u in editUnitOptions" :key="u" :label="u" :value="u" />
            </el-select>
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
          <el-form-item label="备注">
            <el-input v-model="editForm.remark" type="textarea" :rows="2" maxlength="100" show-word-limit
              placeholder="记录特殊交代事项，如：术中分次给药、需心电监护" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="editDlg = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-drawer>
  </div>
  <PickPatient v-else to="/order" :statuses="['ADMITTED', 'IN_SURGERY']" />
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

// 药品拼音首字母：按药品名称索引（同名的多个规格共用一条）
const PY = {
  '丙泊酚注射液': 'bbf bingbofen',
  '注射用瑞芬太尼': 'rfnt ruifentaini',
  '苯磺顺阿曲库铵注射液': 'bbsaq bl',
  '咪达唑仑注射液': 'mdzl midazuolun',
  '盐酸利多卡因注射液': 'liduokayin ldk',
  '注射用盐酸昂丹司琼': 'angdanst',
  '注射用头孢呋辛钠': 'toubaofuxin',
  '0.9% 氯化钠注射液': 'luhuana lh',
  '乳酸林格氏液': 'rusuanlinshi',
  '注射用泮托拉唑钠': 'pantuolazuo',
  '地塞米松磷酸钠注射液': 'dipanmisong',
  '盐酸曲马多注射液': 'qumaduo',
  '盐酸罗哌卡因注射液': 'lpky luopokain',
  '氨甲环酸注射液': 'amhs anhuansuan',
  '注射用帕瑞昔布钠': 'prxbn paraisibu'
}

const route = useRoute()
const filter = reactive({ type: '', anes: '', status: '', kw: '' })
const showRemoved = ref(false)
const editDlg = ref(false)
const editRow = ref(null)
const editForm = reactive({ drugCode: '', dose: 0, unit: '', usage: '', freq: '', remark: '' })
const drugKw = ref('')

const form = reactive({
  type: '临时', drugCode: '', drugName: '', spec: '', dose: 0, unit: '',
  usage: '', freq: '一次', startTime: dayjs().format('YYYY-MM-DD HH:mm:ss'), remark: '', isAnesthetic: false,
  // 口头医嘱：勾选后须填复述人与复述时间
  isVerbal: false, reciter: '', reciteTime: '', verbalNote: ''
})

const patient = computed(() => (route.params.patientId ? getPatient(route.params.patientId) : null))
const schedule = computed(() => (patient.value ? activeSchedule(patient.value.patientId) : null))
const list = computed(() => (patient.value ? ord.listOf(patient.value.patientId) : []))
// 药品字典按名称聚合：同名不同编码 = 同一种药的不同包装规格
const drugGroups = computed(() => {
  const map = new Map()
  state.dicts.drugs.forEach((d) => {
    if (d.removed) return
    if (!map.has(d.name)) map.set(d.name, [])
    map.get(d.name).push(d)
  })
  return Array.from(map, ([name, specs]) => ({ name, specs }))
})
// 药品下拉：按名称去重，规格条数作为副标题
const drugNames = computed(() => {
  const kw = drugKw.value.trim().toLowerCase()
  return drugGroups.value.filter((g) => {
    if (!g.specs.some((s) => s.enabled)) return false
    if (!kw) return true
    if (g.name.toLowerCase().includes(kw)) return true
    if ((PY[g.name] || '').toLowerCase().includes(kw)) return true
    return g.specs.some((s) => (s.spec || '').toLowerCase().includes(kw))
  })
})
// 当前药品名下的全部规格（含停用规格，停用项灰显不可选）
const specOptions = computed(() => {
  const g = drugGroups.value.find((x) => x.name === form.drugName)
  return g ? g.specs : []
})
// 单位候选：该药品各规格的计量单位（规格切换后自动带出对应单位）
const unitOptions = computed(() => {
  const set = new Set()
  specOptions.value.forEach((s) => { if (s.enabled) set.add(s.unit) })
  if (form.unit) set.add(form.unit)
  return Array.from(set)
})
const enabledSpecs = (g) => g.specs.filter((s) => s.enabled)
const anestheticCount = computed(() => list.value.filter((o) => o.isAnesthetic && !o.removed).length)
const activeCount = computed(() => list.value.filter((o) => o.execStatus === '执行中' && !o.removed).length)
// 待提交医嘱：新增后先落在这里，确认无误后一次性提交
const pendingCount = computed(() => list.value.filter((o) => o.execStatus === '待提交' && !o.removed).length)
const submittedCount = computed(() => list.value.filter((o) => o.execStatus !== '待提交' && !o.removed).length)
// 麻醉药核对：招标第 13 项要求手术医嘱至少包含术中使用的麻醉药
const anesRows = computed(() => list.value.filter((o) => o.isAnesthetic && !o.removed && o.execStatus !== '已作废'))

const rows = computed(() => list.value
  .filter((o) => showRemoved.value || !o.removed)
  .filter((o) => !filter.type || o.type === filter.type)
  .filter((o) => !filter.anes || (filter.anes === '1' ? o.isAnesthetic : !o.isAnesthetic))
  .filter((o) => !filter.status || o.execStatus === filter.status)
  .filter((o) => !filter.kw || o.drugName.includes(filter.kw)))

// 修改医嘱：该药品名下的全部规格
const editSpecs = computed(() => {
  const row = editRow.value
  if (!row) return []
  return state.dicts.drugs.filter((d) => d.name === row.drugName && !d.removed)
})
const editUnitOptions = computed(() => {
  const set = new Set()
  editSpecs.value.forEach((s) => { if (s.enabled) set.add(s.unit) })
  if (editForm.unit) set.add(editForm.unit)
  return Array.from(set)
})

function filterDrug(v) { drugKw.value = v }

/** 选药品：带出该药品的第一个可用规格 */
function onDrugName(name) {
  form.drugCode = ''
  form.spec = ''
  form.dose = 0
  form.unit = ''
  form.usage = ''
  form.isAnesthetic = false
  const g = drugGroups.value.find((x) => x.name === name)
  if (!g) return
  const first = g.specs.find((s) => s.enabled)
  if (!first) return
  form.drugCode = first.code
  onSpec(first.code)
}

/** 切规格：剂量单位、默认剂量、默认用法随之刷新 */
function onSpec(code) {
  const d = state.dicts.drugs.find((x) => x.code === code)
  if (!d) return
  form.spec = d.spec
  form.dose = d.dose
  form.unit = d.unit
  form.usage = d.usage
  form.isAnesthetic = d.isAnesthetic
}

function doAdd() {
  if (!form.drugCode) return ElMessage.warning('请先选择药品规格')
  try {
    ord.add(patient.value.patientId, { ...form })
    ElMessage.success(
      `已添加医嘱：${form.drugName}（${form.spec}）${form.dose}${form.unit} ${form.usage}` +
      `${form.isAnesthetic ? '（麻醉药）' : ''}${form.isVerbal ? '（口头医嘱）' : ''}，当前状态「待提交」`
    )
    form.drugCode = ''
    form.drugName = ''
    form.dose = 0
    form.spec = ''
    form.unit = ''
    form.usage = ''
    form.remark = ''
    form.isVerbal = false
    form.reciter = ''
    form.reciteTime = ''
    form.verbalNote = ''
  } catch (e) { ElMessage.error(e.message) }
}

/** 确认无误后一次性提交全部待提交医嘱 */
function doSubmitOrders() {
  if (!pendingCount.value) return ElMessage.warning('没有待提交的医嘱')
  const verbalPending = list.value.filter((o) => o.execStatus === '待提交' && !o.removed && o.isVerbal)
  const missingReciter = verbalPending.filter((o) => !o.reciter || !o.reciteTime)
  if (missingReciter.length) {
    return ElMessage.warning(`有 ${missingReciter.length} 条口头医嘱未填写复述人或复述时间，不能提交`)
  }
  const tip = anesRows.value.length
    ? ''
    : '　注意：本次提交的医嘱中没有麻醉药，招标第 13 项要求手术医嘱至少包含术中使用的麻醉药。'
  ElMessageBox.confirm(
    `确认提交当前 ${pendingCount.value} 条待提交医嘱？提交后医嘱正式生效，不能再直接移除。${tip}`,
    '一次性提交手术医嘱', { type: 'warning', confirmButtonText: '确认提交', cancelButtonText: '再检查一下' }
  ).then(() => {
    try {
      const list2 = ord.submitPending(patient.value.patientId)
      ElMessage.success(`已一次性提交 ${list2.length} 条手术医嘱`)
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function stTag(row) {
  return { 待提交: 'warning', 执行中: 'success', 已执行: 'primary', 已停止: 'info', 已作废: 'info' }[row.execStatus] || 'info'
}

function openEdit(row) {
  editRow.value = row
  Object.assign(editForm, {
    drugCode: row.drugCode, dose: row.dose, unit: row.unit,
    usage: row.usage, freq: row.freq, remark: row.remark || ''
  })
  editDlg.value = true
}

/** 修改医嘱时换规格：单位跟随新规格，剂量保留医师填写的值 */
function onEditSpec(code) {
  const d = state.dicts.drugs.find((x) => x.code === code)
  if (!d) return
  editForm.unit = d.unit
}

function saveEdit() {
  try {
    ord.patch(editRow.value.orderId, {
      drugCode: editForm.drugCode, dose: editForm.dose, unit: editForm.unit,
      usage: editForm.usage, freq: editForm.freq, remark: editForm.remark
    }, '调整医嘱规格、剂量、用法或备注')
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
/* 口头医嘱填写区：与普通录入区区分，提示这是复述留痕 */
.verbal-row { background: #fffaf0; border-color: #f0d9a8; }
</style>

<!-- 下拉弹层挂到 body，样式不能写在 scoped 里 -->
<style>
.spec-popper { min-width: 210px !important; }
.spec-popper .el-select-dropdown__item { gap: 16px; }
.opt-tail { margin-left: auto; color: #8a94a6; }
</style>
