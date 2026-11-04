<template>
  <div>
    <div class="card">
      <div class="card-head">
        <div class="card-title">系统参数</div>
        <div class="card-sub">通知参数改动后，待发送通知的发送时间会实时重算</div>
        <div class="right">
          <span class="tiny">最近保存：{{ lastSaved }}</span>
        </div>
      </div>

      <div class="section-h">一、通知参数 <span class="src">对应招标第 6、7、10 项</span></div>
      <el-form label-width="188px" label-position="right" style="max-width:760px">
        <el-form-item>
          <template #label>
            <span>入院前通知提前天数</span>
          </template>
          <div class="flex gap12" style="width:100%">
            <el-input-number v-model="form.preAdmissionNoticeDays" :min="1" :max="7" controls-position="right" style="width:130px" />
            <span class="tiny">手术日前 N 天 09:00 发送入院提醒短信（1—7 可调）</span>
          </div>
        </el-form-item>
        <el-form-item label="预约成功短信自动发送">
          <div class="flex gap12">
            <el-switch v-model="form.autoSendAppointmentSms" />
            <span class="tiny">创建预约后立即发送（默认开启）</span>
          </div>
        </el-form-item>
        <el-form-item label="安排变动通知渠道">
          <div class="flex gap12">
            <el-radio-group v-model="form.changeNoticeChannel">
              <el-radio label="短信">短信</el-radio>
              <el-radio label="电话">电话</el-radio>
              <el-radio label="BOTH">两者</el-radio>
            </el-radio-group>
            <span class="tiny">手术安排与预约不一致时使用</span>
          </div>
        </el-form-item>
        <el-form-item label="术前禁食提示语">
          <el-input v-model="form.fastingTip" type="textarea" :rows="3" maxlength="200" show-word-limit style="width:100%" />
        </el-form-item>
      </el-form>

      <div class="divider-h"></div>

      <div class="section-h">二、麻醉评估流程 <span class="src">只读 · 节点顺序支持管理员配置（招标第 5 项）</span></div>
      <div class="readonly-band">
        <div class="flow-line">
          <span class="node">术前访视</span>
          <span class="arrow">→</span>
          <span class="node">ASA 分级</span>
          <span class="arrow">→</span>
          <span class="node">麻醉方式建议</span>
          <span class="arrow">→</span>
          <span class="node">结论</span>
        </div>
        <div class="tiny mt8">演示环境固定为以上 4 步；节点顺序与必填项可在正式版由管理员配置。</div>
      </div>

      <div class="divider-h"></div>

      <div class="section-h">三、演示环境信息 <span class="src">只读</span></div>
      <el-table :data="envRows" size="small" border style="width:620px">
        <el-table-column prop="k" label="项" width="180" />
        <el-table-column prop="v" label="值" />
      </el-table>

      <div class="flex gap8 mt12" style="justify-content:flex-end">
        <el-button @click="doRestore">恢复默认</el-button>
        <el-button type="primary" :disabled="!dirty" @click="doSave">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { state } from '@/store/db'
import * as settings from '@/store/settings'

const form = reactive({ ...state.settings })
const lastSaved = ref('本次会话未保存')

const dirty = computed(() => Object.keys(form).some((k) => String(form[k]) !== String(state.settings[k])))

const envRows = [
  { k: '数据存储', v: '浏览器 localStorage（演示沙箱）' },
  { k: '数据范围', v: '不限制（演示环境）' },
  { k: '日志上限', v: '2000 条（达到上限停止写入并提示）' },
  { k: '外部数据源', v: '本地模拟 HIS · LIS / PACS（只读）' },
  { k: '版本', v: 'v1.4 Demo' }
]

function doSave() {
  const n = settings.save({ ...form })
  lastSaved.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  ElMessage.success(`参数已保存，${n} 条待发送通知的发送时间已重算`)
}

function doRestore() {
  ElMessageBox.confirm('确认将全部参数恢复为默认值？', '恢复默认', { type: 'warning' })
    .then(() => {
      settings.restoreDefault()
      Object.assign(form, state.settings)
      ElMessage.success('已恢复默认参数')
    }).catch(() => {})
}

watch(() => state.settings, (v) => {
  Object.keys(form).forEach((k) => { form[k] = v[k] })
}, { deep: true })
</script>

<style scoped>
.readonly-band { background: #f7f8fa; border: 1px solid #e8ebf0; border-radius: 8px; padding: 16px; }
.flow-line { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.flow-line .node {
  background: #fff; border: 1px solid #cdd9e6; color: #2b567f; border-radius: 6px;
  padding: 6px 14px; font-size: 12.5px; font-weight: 600;
}
.flow-line .arrow { color: #a8b6c8; }
</style>
