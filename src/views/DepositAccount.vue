<template>
  <div>
    <!-- 账户列表（未指定患者） -->
    <template v-if="!patient">
      <div class="card">
        <div class="card-head">
          <div class="card-title">储值金账户列表</div>
          <div class="card-sub">日间手术专项储值金：缴存 → 冻结 → 转入住院 / 门诊结算</div>
        </div>
        <div class="toolbar">
          <el-input v-model="kw" placeholder="住院号 / 姓名" clearable :prefix-icon="Search" style="width:200px" />
          <el-select v-model="accStatus" placeholder="账户状态" clearable style="width:140px">
            <el-option v-for="(v, k) in ACC_STATUS" :key="k" :label="v.label" :value="k" />
          </el-select>
          <span class="muted">金额区间</span>
          <el-input-number v-model="min" :min="0" :step="1000" controls-position="right" size="small" style="width:120px" />
          <span class="muted">—</span>
          <el-input-number v-model="max" :min="0" :step="1000" controls-position="right" size="small" style="width:120px" />
          <span class="muted" style="margin-left:auto">共 {{ accRows.length }} 个账户</span>
        </div>
        <el-table :data="accRows" size="small" border style="width:100%">
          <el-table-column label="患者" width="150">
            <template #default="{ row }">
              <div>{{ pname(row.patientId) }}</div>
              <div class="tiny mono">{{ pno(row.patientId) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="账户状态" width="112">
            <template #default="{ row }">
              <el-tag size="small" :type="ACC_STATUS[row.status].type">{{ ACC_STATUS[row.status].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分单" width="112" align="center">
            <template #default="{ row }">
              <el-tooltip :disabled="!subCount(row)" placement="top">
                <template #content>
                  <div v-for="s in row.subOrders || []" :key="s.orderNo">{{ s.orderNo }} · {{ SUB_STATUS[s.status].label }}</div>
                </template>
                <span class="num">{{ subCount(row) }} 张</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="缴存总额" width="120" align="right">
            <template #default="{ row }"><span class="num">¥{{ fmtAmount(row.totalDeposit) }}</span></template>
          </el-table-column>
          <el-table-column label="可用余额" width="120" align="right">
            <template #default="{ row }"><span class="num">{{ fmtAmount(row.available) }}</span></template>
          </el-table-column>
          <el-table-column label="冻结金额" width="120" align="right">
            <template #default="{ row }">
              <span class="num" :style="{ color: row.frozen > 0 ? '#c05621' : '#9aa4b4', fontWeight: row.frozen > 0 ? 600 : 400 }">
                {{ fmtAmount(row.frozen) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="住院储值金" width="120" align="right">
            <template #default="{ row }"><span class="num">{{ fmtAmount(row.inpatientDeposit) }}</span></template>
          </el-table-column>
          <el-table-column label="患者状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="PATIENT_STATUS[pstatus(row.patientId)].type" effect="plain">
                {{ PATIENT_STATUS[pstatus(row.patientId)].label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="go(row.patientId)">账户详情</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 账户详情 -->
    <template v-else>
      <PatientHeader :patient="patient">
        <template #actions>
          <el-tag :type="ACC_STATUS[account.status].type" effect="dark">{{ ACC_STATUS[account.status].label }}</el-tag>
        </template>
      </PatientHeader>

      <!-- 退出日间手术的记录：退出原因与说明（招标第 16 项要求留痕） -->
      <div v-if="withdrawInfo" class="card" style="margin-bottom:14px">
        <div class="card-head">
          <div class="card-title">退出日间手术记录</div>
          <div class="card-sub">
            {{ withdrawInfo.auto ? '系统自动退出（评估不通过触发）' : '由管理中心发起退出' }}
          </div>
        </div>
        <div class="flex" style="gap:32px;flex-wrap:wrap">
          <div><div class="tiny">退出原因</div><div>{{ withdrawInfo.reason }}</div></div>
          <div><div class="tiny">原因说明</div><div>{{ withdrawInfo.note || '—' }}</div></div>
          <div><div class="tiny">退出时间</div><div class="num">{{ withdrawInfo.at ? withdrawInfo.at.slice(0, 16) : '—' }}</div></div>
          <div><div class="tiny">操作人</div><div>{{ withdrawInfo.operator || '—' }}</div></div>
        </div>
      </div>

      <div class="money-grid" style="margin-bottom:14px">
        <div class="money-card blue">
          <div class="k"><el-icon><Wallet /></el-icon> 缴存总额</div>
          <div class="v">¥{{ fmtAmount(account.totalDeposit) }}</div>
          <div class="u">累计缴存（含冲正调整）</div>
        </div>
        <div class="money-card" :class="account.available > 0 ? 'green' : 'grey'">
          <div class="k"><el-icon><Coin /></el-icon> 可用余额</div>
          <div class="v">¥{{ fmtAmount(account.available) }}</div>
          <div class="u">可用于冻结与支取</div>
        </div>
        <div class="money-card" :class="account.frozen > 0 ? 'orange' : 'grey'">
          <div class="k"><el-icon><Lock /></el-icon> 冻结金额</div>
          <div class="v">¥{{ fmtAmount(account.frozen) }}</div>
          <div class="u">已冻结专款专用，不可支取</div>
        </div>
        <div class="money-card blue">
          <div class="k"><el-icon><OfficeBuilding /></el-icon> 住院储值金</div>
          <div class="v">¥{{ fmtAmount(account.inpatientDeposit) }}</div>
          <div class="u">转住院后可用余额</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">账户操作</div>
          <div class="card-sub">四栏金额满足：可用 + 冻结 + 住院 + 已消耗 = 缴存总额</div>
          <div class="right">
            <el-button v-if="account.status !== 'SETTLED' && can('dep.deposit')" type="primary" :icon="Plus" @click="depositDlg = true">缴存储值金</el-button>
            <el-button v-if="canFreeze && can('dep.freeze')" type="warning" :icon="Lock" @click="openFreeze">冻结储值金</el-button>
            <el-button v-if="hasFrozenSub && can('dep.transfer')" type="primary" :icon="Right" @click="doTransfer">转住院（转入住院储值金）</el-button>
            <el-button v-if="account.status === 'TRANSFERRED_IN'" disabled>已转入住院账户</el-button>
            <el-button v-if="account.status === 'TRANSFERRED_IN'" @click="viewInpatient">查看住院储值金</el-button>
            <el-button v-if="account.status === 'SETTLED'" @click="viewSettlement">查看门诊结算单</el-button>
            <el-button v-if="hasFrozenSub && can('dep.unfreeze')" type="warning" plain @click="doUnfreeze">解冻并门诊结算</el-button>
            <el-button v-if="canExit && can('dep.exit')" type="danger" plain @click="openWithdraw">退出日间手术</el-button>
          </div>
        </div>

        <div class="flex" style="justify-content:space-between;margin-bottom:10px">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="account">账户视角</el-radio-button>
            <el-radio-button label="flow">流水视角</el-radio-button>
          </el-radio-group>
          <span class="tiny">
            最近变更：{{ lastFlow ? lastFlow.time.slice(0, 16) : '—' }} · 操作员 {{ lastFlow ? lastFlow.operator : '—' }}
          </span>
        </div>

        <!-- 账户视角：发生时间 / 发生金额 / 业务类型 / 用途 / 备注 -->
        <template v-if="viewMode === 'account'">
          <el-table :data="flows" size="small" border style="width:100%" :row-class-name="flowRowClass">
            <el-table-column label="发生时间" width="158">
              <template #default="{ row }"><span class="num">{{ row.time.slice(0, 16) }}</span></template>
            </el-table-column>
            <el-table-column label="发生金额" width="128" align="right">
              <template #default="{ row }">
                <span class="num" :class="{ strike: row.voided, 'amount-red': row.amount < 0 }">
                  {{ row.amount >= 0 ? '+' : '-' }}¥{{ fmtAmount(Math.abs(row.amount)) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="业务类型" width="104">
              <template #default="{ row }">
                <el-tag size="small" :type="flowTag(row)" effect="plain">{{ FLOW_TYPE[row.type] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="用途" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.purpose">{{ row.purpose }}</span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="240" show-overflow-tooltip />
            <template #empty><div class="empty">该账户暂无资金变动</div></template>
          </el-table>
        </template>

        <!-- 流水视角：流水号 / 发生时间 / 发生金额 / 业务类型 / 用途 / 备注 / 操作员 / 状态 -->
        <template v-else>
          <el-table :data="flows" size="small" border :row-class-name="flowRowClass">
            <el-table-column label="流水号" width="106">
              <template #default="{ row }"><span class="mono">{{ row.flowId }}</span></template>
            </el-table-column>
            <el-table-column label="发生时间" width="150">
              <template #default="{ row }"><span class="num">{{ row.time.slice(0, 16) }}</span></template>
            </el-table-column>
            <el-table-column label="发生金额" width="122" align="right">
              <template #default="{ row }">
                <span class="num" :class="{ strike: row.voided, 'amount-red': row.amount < 0 }">
                  {{ row.amount >= 0 ? '+' : '-' }}¥{{ fmtAmount(Math.abs(row.amount)) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="业务类型" width="104">
              <template #default="{ row }">{{ FLOW_TYPE[row.type] }}</template>
            </el-table-column>
            <el-table-column label="用途" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.purpose">{{ row.purpose }}</span>
                <span v-else class="muted">—</span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip />
            <el-table-column prop="operator" label="操作员" width="80" />
            <el-table-column label="状态" width="86" align="center">
              <template #default="{ row }">
                <span :class="row.voided ? 'amount-red' : 'amount-green'">{{ row.voided ? '已冲正' : '正常' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="{ row }">
                <el-button v-if="row.type === 'DEPOSIT' && !row.voided && account.status !== 'SETTLED' && can('dep.reverse')"
                  link type="danger" size="small" @click="openReverse(row)">冲正</el-button>
                <span v-else class="tiny">—</span>
              </template>
            </el-table-column>
            <template #empty><div class="empty">该账户暂无流水记录</div></template>
          </el-table>
        </template>

        <div class="notice-bar mt12">
          <el-icon><InfoFilled /></el-icon>
          业务流水一经记账不可改动，纠错一律使用「冲正」：原记录灰显保留，同时生成一笔负数流水，金额恒等式始终成立。
        </div>
      </div>

      <!-- 分单管理 -->
      <div class="card" style="margin-top:14px">
        <div class="card-head">
          <div class="card-title">分单管理</div>
          <div class="card-sub">
            同一患者多次日间手术可分单管理、分别结算；分单号即关联申请单号，冻结金额专款专用
          </div>
        </div>
        <el-table :data="subOrders" size="small" border style="width:100%">
          <el-table-column prop="orderNo" label="分单号 / 关联申请单号" width="170">
            <template #default="{ row }"><span class="mono">{{ row.orderNo }}</span></template>
          </el-table-column>
          <el-table-column prop="surgeryName" label="手术名称" min-width="160" show-overflow-tooltip />
          <el-table-column label="冻结金额" width="118" align="right">
            <template #default="{ row }"><span class="num">¥{{ fmtAmount(row.frozen) }}</span></template>
          </el-table-column>
          <el-table-column label="用途" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.purpose || '—' }}</template>
          </el-table-column>
          <el-table-column label="有效期" width="176">
            <template #default="{ row }">
              <span class="num">{{ row.validFrom || '—' }} ~ {{ row.validTo || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="94" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="SUB_STATUS[row.status].type" effect="plain">{{ SUB_STATUS[row.status].label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="结算单" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.settlement" class="mono">{{ row.settlement.settlementNo }}</span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty">
              <div class="big">—</div>
              该患者暂无分单，办理冻结时填写关联申请单号即可自动建单
            </div>
          </template>
        </el-table>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="card-head">
          <div class="card-title">本账户操作留痕</div>
          <div class="card-sub">只追加、不可修改，每笔操作均记录九要素（操作人 / 时间 / 模块 / 对象 / 变更前后 / 原因 / 结果）</div>
          <div v-if="can('log')" class="right">
            <el-button text size="small" @click="router.push('/log')">查看全部日志</el-button>
          </div>
        </div>
        <el-table :data="accountLogs" size="small" border style="width:100%">
          <el-table-column label="时间" width="158">
            <template #default="{ row }"><span class="num">{{ row.time.slice(0, 16) }}</span></template>
          </el-table-column>
          <el-table-column label="操作人" width="118">
            <template #default="{ row }">{{ row.operator }}<span class="muted tiny"> · {{ row.role }}</span></template>
          </el-table-column>
          <el-table-column prop="page" label="页面" width="112" />
          <el-table-column label="动作" width="96" align="center">
            <template #default="{ row }"><el-tag size="small" effect="plain">{{ ACTION_LABEL[row.action] || row.action }}</el-tag></template>
          </el-table-column>
          <el-table-column label="变更摘要" min-width="240">
            <template #default="{ row }">
              <span v-if="row.diff && row.diff.length" class="muted">
                {{ row.diff[0].label }} {{ row.diff[0].from }} → {{ row.diff[0].to }}
                <template v-if="row.diff.length > 1"> 等 {{ row.diff.length }} 项</template>
              </span>
              <span v-else class="muted">{{ afterText(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
          <el-table-column label="结果" width="76" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.result === 'FAIL' ? '#c53030' : '#2f855a' }">{{ row.result === 'FAIL' ? '失败' : '成功' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="校验码" width="92">
            <template #default="{ row }"><span class="mono tiny">{{ row.chain }}</span></template>
          </el-table-column>
          <template #empty><div class="empty">该患者暂无操作留痕</div></template>
        </el-table>
      </div>
    </template>

    <!-- 缴存 -->
    <el-dialog v-model="depositDlg" title="缴存日间手术专项储值金" width="440px">
      <el-form label-width="88px">
        <el-form-item label="患者">
          <el-input :model-value="`${patient.name}　${patient.inpatientNo}`" disabled class="field-readonly" />
        </el-form-item>
        <el-form-item label="缴存金额" required>
          <el-input-number v-model="depositForm.amount" :min="1" :step="500" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="缴存方式" required>
          <el-radio-group v-model="depositForm.method">
            <el-radio label="现金">现金</el-radio>
            <el-radio label="银行卡">银行卡</el-radio>
            <el-radio label="扫码">扫码</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="depositDlg = false">取消</el-button>
        <el-button type="primary" @click="doDeposit">确认缴存</el-button>
      </template>
    </el-dialog>

    <!-- 冻结 -->
    <el-dialog v-model="freezeDlg" title="冻结日间手术专项储值金" width="520px">
      <div class="hint-box info" style="margin-bottom:12px">
        <el-icon><InfoFilled /></el-icon>
        <div>冻结需填写<strong>金额、用途、有效期、关联申请单号</strong>；确认后冻结金额专款专用，不可直接支取。</div>
      </div>
      <el-form label-width="96px">
        <el-form-item label="冻结金额" required>
          <el-input-number v-model="freezeForm.amount" :min="0.01" :max="account?.available || 0" :step="500" :precision="2" style="width:100%" />
          <div class="tiny mt8">可用余额 ¥{{ fmtAmount(account?.available || 0) }}</div>
        </el-form-item>
        <el-form-item label="冻结用途" required>
          <el-select v-model="freezeForm.purpose" filterable allow-create placeholder="请选择或输入冻结用途" style="width:100%">
            <el-option v-for="p in FREEZE_PURPOSES" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="有效期" required>
          <el-date-picker v-model="freezeForm.validRange" type="daterange" value-format="YYYY-MM-DD"
            start-placeholder="开始日期" end-placeholder="截止日期" style="width:100%" />
        </el-form-item>
        <el-form-item label="关联申请单号" required>
          <el-select v-model="freezeForm.applyNo" filterable allow-create placeholder="请选择或输入关联申请单号" style="width:100%">
            <el-option v-for="a in applyNos" :key="a" :label="a" :value="a" />
          </el-select>
          <div class="tiny mt8">一次日间手术一张分单，分单号即关联申请单号，可分别结算。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="freezeDlg = false">取消</el-button>
        <el-button type="warning" @click="doFreeze">确认冻结</el-button>
      </template>
    </el-dialog>

    <!-- 退出 -->
    <el-dialog v-model="withdrawDlg" title="发起退出日间手术" width="520px">
      <el-form label-width="88px">
        <el-form-item label="退出原因" required>
          <el-radio-group v-model="withdrawForm.reason">
            <el-radio v-for="r in WITHDRAW_REASONS" :key="r" :label="r">{{ r }}</el-radio>
          </el-radio-group>
          <div class="tiny mt8">
            「{{ WITHDRAW_REASON_ANESTHESIA }}」＝麻醉评估没有通过、无法继续完成日间手术；
            「{{ WITHDRAW_REASON_PHONE }}」＝病人电话联系日间手术中心告知不做手术。
          </div>
        </el-form-item>
        <el-form-item v-if="noteVisible" :label="noteLabel" :required="noteRequired">
          <el-input v-model="withdrawForm.note" type="textarea" :rows="2" maxlength="200" show-word-limit
            :placeholder="notePlaceholder" />
          <div v-if="withdrawForm.reason === WITHDRAW_REASON_ANESTHESIA && !anesthesiaFail" class="tiny mt8">
            该患者暂无麻醉评估不通过记录，请核对后填写具体情况。
          </div>
        </el-form-item>
      </el-form>
      <div class="hint-box warn">
        <el-icon><Warning /></el-icon>
        <div>
          退出后患者结束日间手术流程。
          <template v-if="hasFrozenSub">
            冻结金额仍保持专款专用，由<b>收费员</b>办理「解冻并门诊结算」后按分单分别退回。
          </template>
          <template v-else>该账户当前没有冻结金额，无需解冻。</template>
        </div>
      </div>
      <template #footer>
        <el-button @click="withdrawDlg = false">取消</el-button>
        <el-button type="danger" @click="doWithdraw">确认退出</el-button>
      </template>
    </el-dialog>

    <!-- 结算单 -->
    <el-dialog v-model="settleDlg" title="门诊结算单（按分单分别结算）" width="760px">
      <el-table :data="settlements" size="small" border>
        <el-table-column prop="settlementNo" label="结算单号" width="140">
          <template #default="{ row }"><span class="mono">{{ row.settlementNo }}</span></template>
        </el-table-column>
        <el-table-column prop="applyNo" label="分单号" width="150">
          <template #default="{ row }"><span class="mono">{{ row.applyNo }}</span></template>
        </el-table-column>
        <el-table-column label="结算时间" width="140">
          <template #default="{ row }"><span class="num">{{ row.at.slice(0, 16) }}</span></template>
        </el-table-column>
        <el-table-column label="已产生费用" width="106" align="right">
          <template #default="{ row }"><span class="num">¥{{ fmtAmount(row.total) }}</span></template>
        </el-table-column>
        <el-table-column label="退回金额" width="106" align="right">
          <template #default="{ row }"><span class="num amount-green">¥{{ fmtAmount(row.refund) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openSettlement(row)">明细</el-button>
          </template>
        </el-table-column>
        <template #empty><div class="empty">暂无结算单</div></template>
      </el-table>
      <template #footer>
        <el-button @click="settleDlg = false">关闭</el-button>
        <el-button type="primary" @click="fakePrint">打印结算单</el-button>
      </template>
    </el-dialog>

    <!-- 结算单明细 -->
    <el-dialog v-model="settleDetailDlg" title="门诊结算单明细" width="560px">
      <template v-if="settlement">
        <div class="flex" style="justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-weight:700;font-size:14px">{{ settlement.settlementNo }}</div>
            <div class="tiny">分单 {{ settlement.applyNo }} · 结算时间 {{ settlement.at }}</div>
          </div>
          <el-tag type="success" effect="plain">已结算</el-tag>
        </div>
        <el-table :data="settlement.lines" size="small" border>
          <el-table-column prop="name" label="已产生门诊费用" />
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">¥{{ fmtAmount(row.amount) }}</template>
          </el-table-column>
        </el-table>
        <div class="kv mt12" style="grid-template-columns:110px 1fr 110px 1fr">
          <div class="k">费用合计</div><div class="v num">¥{{ fmtAmount(settlement.total) }}</div>
          <div class="k">退回金额</div><div class="v num amount-green" style="font-weight:700">¥{{ fmtAmount(settlement.refund) }}</div>
          <div class="k">退出原因</div><div class="v">{{ settlement.reason }}</div>
          <div class="k">备注</div><div class="v">{{ settlement.note || '—' }}</div>
        </div>
        <div class="hint-box info mt12">
          <el-icon><InfoFilled /></el-icon>
          结算单由系统按分单自动生成，不涉及退费复核；冻结金额已解冻并按实际发生费用抵扣。
        </div>
      </template>
      <template #footer>
        <el-button @click="settleDetailDlg = false">关闭</el-button>
        <el-button type="primary" @click="fakePrint">打印结算单</el-button>
      </template>
    </el-dialog>

    <!-- 冲正 -->
    <el-dialog v-model="reverseDlg" title="冲正缴存记录" width="460px">
      <div v-if="reverseRow" class="hint-box warn">
        <el-icon><Warning /></el-icon>
        将冲正 {{ reverseRow.time.slice(0, 10) }} 的缴存记录 ¥{{ fmtAmount(reverseRow.amount) }}。原记录灰显保留，并生成一笔负数流水。
      </div>
      <el-form label-width="88px" class="mt12">
        <el-form-item label="冲正原因" required>
          <el-select v-model="reverseForm.reason" placeholder="请选择" style="width:100%">
            <el-option v-for="r in REVERSE_REASONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reverseDlg = false">取消</el-button>
        <el-button type="danger" @click="doReverse">确认冲正</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can } from '@/store/session'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Wallet, Coin, Lock, OfficeBuilding, Right, Plus, Warning } from '@element-plus/icons-vue'
import { fmtAmount } from '@/utils/format'
import { get as getPatient } from '@/store/patients'
import * as accStore from '@/store/accounts'
import { latest as latestEval, ANESTHESIA } from '@/store/evals'
import {
  WITHDRAW_REASONS, WITHDRAW_REASON_ANESTHESIA, WITHDRAW_REASON_PHONE, WITHDRAW_REASON_GIVEUP,
  WITHDRAW_REASON_OTHER, REVERSE_REASONS, PATIENT_STATUS
} from '@/mock/dict'
import PatientHeader from '@/components/PatientHeader.vue'
import { queryByPatient } from '@/store/logs'
import { ACTION_LABEL } from '@/utils/audit'

const route = useRoute()
const router = useRouter()
const ACC_STATUS = accStore.ACCOUNT_STATUS
const FLOW_TYPE = accStore.FLOW_TYPE
const SUB_STATUS = accStore.SUB_STATUS
const FREEZE_PURPOSES = accStore.FREEZE_PURPOSES

const kw = ref('')
const accStatus = ref('')
const min = ref(0)
const max = ref(20000)
const viewMode = ref('account')

const depositDlg = ref(false)
const depositForm = reactive({ amount: 8000, method: '扫码' })
const freezeDlg = ref(false)
const freezeForm = reactive({ amount: 0, purpose: '术前检查费用记账', validRange: [], applyNo: '' })
const withdrawDlg = ref(false)
const withdrawForm = reactive({ reason: '', note: '' })
const settleDlg = ref(false)
const settleDetailDlg = ref(false)
const settlement = ref(null)
const reverseDlg = ref(false)
const reverseRow = ref(null)
const reverseForm = reactive({ reason: '' })

const patient = computed(() => (route.params.patientId ? getPatient(route.params.patientId) : null))
const account = computed(() => (patient.value ? accStore.accountOf(patient.value.patientId) : null))
const flows = computed(() => (patient.value ? accStore.flowsOf(patient.value.patientId) : []))
const subOrders = computed(() => (patient.value ? accStore.subOrdersOf(patient.value.patientId) : []))
const applyNos = computed(() => (patient.value ? accStore.applyNosOf(patient.value.patientId) : []))
const lastFlow = computed(() => flows.value[0] || null)
const settlements = computed(() => {
  if (!account.value) return []
  const list = account.value.settlements || []
  if (list.length) return list
  return account.value.settlement ? [account.value.settlement] : []
})
const hasFrozenSub = computed(() => subOrders.value.some((s) => Number(s.frozen) > 0 && s.status !== 'SETTLED'))
// 已退出日间手术的记录（退出原因 / 说明 / 时间 / 操作人）
const withdrawInfo = computed(() => patient.value?.withdrawInfo || null)
const canFreeze = computed(() => !!account.value && account.value.status !== 'SETTLED' && Number(account.value.available) > 0)
// 可发起退出：未结束日间手术流程、储值金未转入住院
const canExit = computed(() =>
  !!account.value && account.value.status !== 'SETTLED' && account.value.status !== 'TRANSFERRED_IN' &&
  patient.value && !['WITHDRAWN', 'DISCHARGED'].includes(patient.value.status))
// 已满足退出条件（手工发起退出 / 评估不通过自动退出）才可解冻
const canUnfreeze = computed(() =>
  !!patient.value && patient.value.status === 'WITHDRAWN' && hasFrozenSub.value)

// 招标第 16 项场景①：麻醉评估没有通过，无法继续完成日间手术 → 可由管理中心退出日间路径
const anesthesiaFail = computed(() => {
  const rec = patient.value ? latestEval(patient.value.patientId, ANESTHESIA) : null
  return rec && rec.conclusion === 'FAILED' ? rec : null
})
const anesthesiaFailNote = computed(() => {
  const rec = anesthesiaFail.value
  if (!rec) return ''
  return [rec.reason, rec.reasonNote].filter(Boolean).join('：')
})
// 退出原因决定说明区的标题、是否必填与提示语
const noteVisible = computed(() => !!withdrawForm.reason && withdrawForm.reason !== WITHDRAW_REASON_GIVEUP)
const noteRequired = computed(() =>
  [WITHDRAW_REASON_ANESTHESIA, WITHDRAW_REASON_OTHER].includes(withdrawForm.reason))
const noteLabel = computed(() => {
  if (withdrawForm.reason === WITHDRAW_REASON_ANESTHESIA) return '评估情况'
  if (withdrawForm.reason === WITHDRAW_REASON_PHONE) return '来电情况'
  return '原因说明'
})
const notePlaceholder = computed(() => {
  if (withdrawForm.reason === WITHDRAW_REASON_ANESTHESIA) return '填写麻醉评估不通过的具体情况（预填内容可修改）'
  if (withdrawForm.reason === WITHDRAW_REASON_PHONE) return '记录来电人、来电时间与患者表述（如：患者本人今日 09:40 来电，因发热取消本次手术）'
  return '选择「其他」时必须填写具体原因'
})
// 选中「麻醉评估不通过」时，把该患者的麻醉评估不通过结论预填进说明区
watch(() => withdrawForm.reason, (r) => {
  withdrawForm.note = ''
  if (r === WITHDRAW_REASON_ANESTHESIA) withdrawForm.note = anesthesiaFailNote.value
})

// 本患者留痕：按时间倒序取最新 6 条（日志本身只追加，不改动）
const accountLogs = computed(() => {
  if (!patient.value) return []
  return queryByPatient(patient.value.patientId)
    .slice()
    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
    .slice(0, 6)
})

// 无字段级差异时，用「记录快照」概括本次操作内容，避免与「原因」列重复
function afterText(row) {
  const after = row.after || {}
  const keys = Object.keys(after)
  if (!keys.length) return '—'
  const head = keys.slice(0, 2).map((k) => `${k} ${after[k]}`).join('、')
  return keys.length > 2 ? `${head} 等 ${keys.length} 项` : head
}

const accRows = computed(() => accStore.all.value.filter((a) => {
  const p = getPatient(a.patientId)
  if (!p) return false
  if (kw.value && !(p.name.includes(kw.value) || p.inpatientNo.includes(kw.value))) return false
  if (accStatus.value && a.status !== accStatus.value) return false
  return Number(a.totalDeposit) >= Number(min.value || 0) && Number(a.totalDeposit) <= Number(max.value || 999999)
}))

const pname = (id) => getPatient(id)?.name || '—'
const pno = (id) => getPatient(id)?.inpatientNo || ''
const pstatus = (id) => getPatient(id)?.status || 'DAY_SURGERY'
const subCount = (row) => (row.subOrders || []).length

function flowTag(row) {
  return { DEPOSIT: 'success', FREEZE: 'warning', OUTPATIENT_CHARGE: 'info', TRANSFER_IN: 'primary', REVERSE: 'danger' }[row.type] || 'info'
}
function flowRowClass({ row }) {
  return row.voided ? 'row-void' : ''
}
function go(id) { router.push('/deposit/' + id) }

function openFreeze() {
  freezeForm.amount = Number(account.value?.available || 0)
  freezeForm.purpose = FREEZE_PURPOSES[0]
  freezeForm.validRange = []
  freezeForm.applyNo = applyNos.value[0] || ''
  freezeDlg.value = true
}

function doFreeze() {
  if (!freezeForm.amount || freezeForm.amount <= 0) return ElMessage.warning('请填写冻结金额')
  if (!freezeForm.purpose) return ElMessage.warning('请填写冻结用途')
  if (!freezeForm.validRange || freezeForm.validRange.length !== 2) return ElMessage.warning('请选择有效期')
  if (!freezeForm.applyNo) return ElMessage.warning('请填写关联申请单号')
  try {
    const r = accStore.freeze(patient.value.patientId, {
      amount: freezeForm.amount,
      purpose: freezeForm.purpose,
      validFrom: freezeForm.validRange[0],
      validTo: freezeForm.validRange[1],
      applyNo: freezeForm.applyNo
    })
    freezeDlg.value = false
    ElMessage.success(`已冻结 ¥${fmtAmount(freezeForm.amount)}（分单 ${r.subOrder.orderNo}），冻结金额专款专用`)
  } catch (e) { ElMessage.error(e.message) }
}

function doTransfer() {
  ElMessageBox.confirm(
    `确认将患者${patient.value.name}的冻结储值金 ¥${fmtAmount(account.value.frozen)} 转入住院储值金？转入后患者状态变更为「已入院」。`,
    '转住院', { type: 'warning', confirmButtonText: '确认转入', cancelButtonText: '取消' }
  ).then(() => {
    try {
      accStore.transferIn(patient.value.patientId)
      ElMessage.success(`已转入住院储值金 ¥${fmtAmount(account.value.inpatientDeposit)}，患者状态更新为已入院`)
    } catch (e) { ElMessage.error(e.message) }
  }).catch(() => {})
}

function viewInpatient() {
  ElMessageBox.alert(
    `住院储值金余额 ¥${fmtAmount(account.value.inpatientDeposit)}，可用于住院期间费用。\n本 Demo 不涉及住院费用场景，仅展示余额。`,
    '住院储值金', { confirmButtonText: '知道了' }
  )
}

function viewSettlement() {
  if (!settlements.value.length) return ElMessage.info('该账户暂无结算单')
  settleDlg.value = true
}

function openSettlement(row) {
  settlement.value = row
  settleDetailDlg.value = true
}

function doDeposit() {
  try {
    accStore.deposit(patient.value.patientId, depositForm.amount, depositForm.method)
    depositDlg.value = false
    ElMessage.success(`已缴存 ¥${fmtAmount(depositForm.amount)}，当前可用余额 ¥${fmtAmount(account.value.available)}`)
  } catch (e) { ElMessage.error(e.message) }
}

function openWithdraw() {
  withdrawForm.reason = ''
  withdrawForm.note = ''
  withdrawDlg.value = true
}

function doWithdraw() {
  if (!withdrawForm.reason) return ElMessage.warning('请选择退出原因')
  if (withdrawForm.reason === WITHDRAW_REASON_ANESTHESIA && !withdrawForm.note.trim()) {
    return ElMessage.warning('请填写麻醉评估不通过的具体情况')
  }
  if (withdrawForm.reason === WITHDRAW_REASON_OTHER && !withdrawForm.note.trim()) {
    return ElMessage.warning('选择「其他」时必须填写原因说明')
  }
  try {
    accStore.exitDaySurgery(patient.value.patientId, withdrawForm.reason, withdrawForm.note)
    withdrawDlg.value = false
    ElMessage.success(
      hasFrozenSub.value
        ? '已发起退出日间手术，冻结金额待收费员办理「解冻并门诊结算」'
        : '已发起退出日间手术，患者流程结束'
    )
  } catch (e) { ElMessage.error(e.message) }
}

/** 收费员解冻：未满足退出条件时提示「当前手术未完成，无法解除冻结」 */
function doUnfreeze() {
  if (!canUnfreeze.value) {
    ElMessage.warning('当前手术未完成，无法解除冻结')
    return
  }
  ElMessageBox.confirm(
    `确认解冻患者${patient.value.name}的冻结储值金 ¥${fmtAmount(account.value.frozen)}？` +
    `解冻后按分单分别结算，扣除已产生的门诊费用后余额退回患者。`,
    '解冻并门诊结算', { type: 'warning', confirmButtonText: '确认解冻', cancelButtonText: '取消' }
  ).then(() => {
    try {
      const list = accStore.unfreeze(patient.value.patientId)
      settleDlg.value = true
      ElMessage.success(`已解冻并结算，生成 ${list.length} 张分单结算单`)
    } catch (e) { ElMessage.warning(e.message) }
  }).catch(() => {})
}

function fakePrint() {
  ElMessage.success('结算单已发送至打印机（演示环境不输出纸质件）')
}

function openReverse(row) {
  reverseRow.value = row
  reverseForm.reason = ''
  reverseDlg.value = true
}

function doReverse() {
  if (!reverseForm.reason) return ElMessage.warning('请选择冲正原因')
  try {
    accStore.reverseFlow(patient.value.patientId, reverseRow.value.flowId, reverseForm.reason)
    reverseDlg.value = false
    ElMessage.success(`已冲正缴存记录 ¥${fmtAmount(reverseRow.value.amount)}，当前可用余额 ¥${fmtAmount(account.value.available)}`)
  } catch (e) { ElMessage.error(e.message) }
}
</script>
