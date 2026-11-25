const redisClient = require('server-utils').redisClient

const _ = require('lodash')
const common = require('../../../util/CommonUtil')
const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')

const Op = model.Op

const tb_usergroup = model.common_usergroup
const tb_user = model.common_user
const tb_user_groups = model.common_user_groups
const tb_vessel = model.zhongtan_invoice_vessel
const tb_uploadfile = model.zhongtan_uploadfile
const tb_blacklist_log = model.zhongtan_customer_blacklist_log

exports.initAct = async () => {
  let returnData = {
    USER_CUSTOMER_TYPE: GLBConfig.USER_CUSTOMER_TYPE
  }
  let queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = 1 GROUP BY fee_data_code ORDER BY fee_data_code`
  let replacements = []
  returnData.EXPORT_SHIPMENTS= await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = 'select * from tbl_common_user where state = "1" and user_type = "' + GLBConfig.TYPE_CUSTOMER + '"'
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (user_username like ? or user_email like ? or user_phone like ? or user_name like ? or user_address like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
  }
  if (doc.search_tin) {
    queryStr += ' and user_tin like ? '
    replacements.push('%' + doc.search_tin + '%')
  }
  if (doc.search_finance) {
    queryStr += ' and (u8_code like ? or u8_alias like ? or u8_vendor_code like ? or u8_vendor_alias like ?) '
    let search_finance = '%' + doc.search_finance + '%'
    replacements.push(search_finance)
    replacements.push(search_finance)
    replacements.push(search_finance)
    replacements.push(search_finance)
  }
  queryStr += ' order by user_blacklist desc, user_username'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let ap of result.data) {
    delete ap.user_password
    returnData.rows.push(ap)
  }

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let usergroup = await tb_usergroup.findOne({
    where: {
      usergroup_code: 'CUSTOMER'
    }
  })

  if (usergroup) {
    let adduser = null
    if(doc.user_tin) {
      adduser = await tb_user.findOne({
        where: {
          state: GLBConfig.ENABLE,
          [Op.or]: [{ user_phone: doc.user_phone }, { user_username: doc.user_username.trim() }, { user_name: doc.user_name.trim() }, { user_tin: doc.user_tin.trim() }]
        }
      })
      if (adduser) {
        return common.error('operator_02')
      }
    } else {
      adduser = await tb_user.findOne({
        where: {
          state: GLBConfig.ENABLE,
          [Op.or]: [{ user_phone: doc.user_phone }, { user_username: doc.user_username.trim() }, { user_name: doc.user_name.trim() }]
        }
      })
      if (adduser) {
        return common.error('operator_02')
      }
    }
    if(doc.payment_atta_files && doc.payment_atta_files.length > 0) {
      for(let f of doc.payment_atta_files) {
        let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'PAYMENT ADVICE ATTACHMENT',
          user_id: user.user_id,
          uploadfile_index1: obj.payment_advice_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url,
          uploadfile_state: 'AP',
          uploadfile_amount: doc.payment_advice_amount,
          uploadfile_currency: doc.payment_advice_currency
        })
      }
    }
    let customer_files = []
    if(doc.customer_atta_files && doc.customer_atta_files.length > 0) {
      for(let f of doc.customer_atta_files) {
        let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
        customer_files.push(fileInfo.url)
      }
    }
    
    adduser = await tb_user.create({
      user_type: GLBConfig.TYPE_CUSTOMER,
      user_username: doc.user_username.trim(),
      user_email: doc.user_email.trim(),
      user_phone: doc.user_phone ? doc.user_phone.trim() : '',
      user_password: GLBConfig.INITPASSWORD,
      user_name: doc.user_name.trim(),
      user_gender: doc.user_gender,
      user_address: doc.user_address.trim(),
      user_address1: doc.user_address1,
      user_address2: doc.user_address2,
      user_zipcode: doc.user_zipcode,
      user_customer_type: doc.user_customer_type,
      user_tin: doc.user_tin ? doc.user_tin.trim() : '',
      user_vrn: doc.user_vrn ? doc.user_vrn.trim() : '',
      user_bank_account_usd: doc.user_bank_account_usd ? doc.user_bank_account_usd.trim() : '',
      user_bank_account_tzs: doc.user_bank_account_tzs ? doc.user_bank_account_tzs.trim() : '',
      export_split_shipment: doc.export_split_shipment ? doc.export_split_shipment : [],
      user_rate: doc.user_rate,
      u8_code: doc.u8_code,
      u8_alias: doc.u8_alias,
      u8_vendor_code: doc.u8_vendor_code,
      u8_vendor_alias: doc.u8_vendor_alias,
      user_attachment: customer_files
    })

    await tb_user_groups.create({
      user_id: adduser.user_id,
      usergroup_id: usergroup.usergroup_id
    })

    let returnData = JSON.parse(JSON.stringify(adduser))
    delete returnData.user_password

    return common.success(returnData)
  } else {
    return common.error('customer_01')
  }
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let user_name = doc.new.user_name.trim()
  let user_phone = doc.new.user_phone ? doc.new.user_phone.trim() : ''
  let user_tin = doc.new.user_tin ? doc.new.user_tin.trim() : ''
  if(user_name) {
    let existUser = await tb_user.findOne({
      where: {
        user_name: user_name,
        state: GLBConfig.ENABLE,
        user_id: {
          [Op.ne]: doc.old.user_id
        }
      }
    })
    if(existUser) {
      return common.error('customer_02')
    }
  }
  if(user_phone) {
    let existUser = await tb_user.findOne({
      where: {
        user_phone: user_phone,
        state: GLBConfig.ENABLE,
        user_id: {
          [Op.ne]: doc.old.user_id
        }
      }
    })
    if(existUser) {
      return common.error('customer_03')
    }
  }
  if(user_tin) {
    let existUser = await tb_user.findOne({
      where: {
        user_tin: user_tin,
        state: GLBConfig.ENABLE,
        user_id: {
          [Op.ne]: doc.old.user_id
        }
      }
    })
    if(existUser) {
      return common.error('customer_04')
    }
  }
  let modiuser = await tb_user.findOne({
    where: {
      user_id: doc.old.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modiuser) {
    modiuser.user_email = doc.new.user_email
    modiuser.user_phone = doc.new.user_phone ? doc.new.user_phone.trim() : ''
    modiuser.user_name = doc.new.user_name.trim()
    modiuser.user_gender = doc.new.user_gender
    modiuser.user_avatar = doc.new.user_avatar
    modiuser.user_address = doc.new.user_address.trim()
    modiuser.user_address1 = doc.new.user_address1
    modiuser.user_address2 = doc.new.user_address2
    modiuser.user_state = doc.new.user_state
    modiuser.user_zipcode = doc.new.user_zipcode
    modiuser.user_customer_type = doc.new.user_customer_type
    modiuser.user_tin = doc.new.user_tin ? doc.new.user_tin.trim() : ''
    modiuser.user_vrn = doc.new.user_vrn ? doc.new.user_vrn.trim() : ''
    modiuser.user_bank_account_usd = doc.new.user_bank_account_usd ? doc.new.user_bank_account_usd.trim() : ''
    modiuser.user_bank_account_tzs = doc.new.user_bank_account_tzs ? doc.new.user_bank_account_tzs.trim() : ''
    modiuser.export_split_shipment = doc.new.export_split_shipment ? doc.new.export_split_shipment : []
    modiuser.user_rate = doc.new.user_rate
    modiuser.u8_code = doc.new.u8_code
    modiuser.u8_alias = doc.new.u8_alias
    modiuser.u8_vendor_code = doc.new.u8_vendor_code
    modiuser.u8_vendor_alias = doc.new.u8_vendor_alias
    let user_attachment = []
    if(doc.new.customer_atta_files && doc.new.customer_atta_files.length > 0) {
      if(modiuser.user_attachment && modiuser.user_attachment.length > 0) {
        user_attachment = modiuser.user_attachment
      }
      for(let f of doc.new.customer_atta_files) {
        let fileInfo = await common.fileSaveMongo(f.response.info.path, 'zhongtan')
        user_attachment.push(fileInfo.url)
      }
    }
    modiuser.user_attachment = user_attachment
    await modiuser.save()

    let returnData = JSON.parse(JSON.stringify(modiuser))
    delete returnData.user_password
    logger.debug('modify success')
    return common.success(returnData)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let deluser = await tb_user.findOne({
    where: {
      user_id: doc.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (deluser) {
    deluser.state = GLBConfig.DISABLE
    await deluser.save()
    redisClient.del(['REDISKEYAUTH', 'WEB', deluser.user_id].join('_'))
    redisClient.del(['REDISKEYAUTH', 'MOBILE', deluser.user_id].join('_'))
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.changeBlacklistAct = async req => {
  let doc = common.docValidate(req)
  let modiuser = await tb_user.findOne({
    where: {
      user_id: doc.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modiuser) {
    let beforeStatus = modiuser.user_blacklist
    modiuser.user_blacklist = doc.user_blacklist
    if(doc.user_blacklist === GLBConfig.ENABLE) {
      modiuser.blacklist_from = GLBConfig.ENABLE
    } else {
      modiuser.blacklist_from = GLBConfig.DISABLE
    }
    await modiuser.save()

    let operator = req.user || {}
    await writeBlacklistLog({
      customer_id: doc.user_id,
      customer_name: modiuser.user_name,
      action: doc.user_blacklist === GLBConfig.ENABLE ? 'LOCK' : 'UNLOCK',
      source: 'MANUAL',
      reason_code: 'MANUAL',
      reason_text: doc.blacklist_remark || (doc.user_blacklist === GLBConfig.ENABLE ? '人工锁定' : '人工解除'),
      order_no: modiuser.blacklist_order || null,
      before_status: beforeStatus,
      after_status: doc.user_blacklist,
      operator_id: operator.user_id || null,
      operator_name: operator.user_name || operator.user_username || null
    })
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.exportCustomerAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = 'select * from tbl_common_user where state = "1" and user_type = "' + GLBConfig.TYPE_CUSTOMER + '"'
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (user_username like ? or user_email like ? or user_phone like ? or user_name like ? or user_address like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
  }
  queryStr += ' order by user_blacklist desc, user_username'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []

  for (let r of result) {
    if(r.user_customer_type) {
      for(let t of GLBConfig.USER_CUSTOMER_TYPE) {
        if(r.user_customer_type === t.id) {
          r.user_customer_type_name = t.text
        }
      }
    }
    renderData.push(r)
  }

  let filepath = await common.ejs2xlsx('CustomerTemplate.xlsx', renderData)

  res.sendFile(filepath)
}

exports.changeRateAct = async req => {
  let doc = common.docValidate(req)
  let modiuser = await tb_user.findOne({
    where: {
      user_id: doc.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modiuser) {
    modiuser.user_rate = doc.user_rate
    await modiuser.save()
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}

exports.checkBlacklistAct = async user_id => {
  if(user_id) {
    let user = await tb_user.findOne({
      where: {
        user_id: user_id,
        state: GLBConfig.ENABLE
      }
    })
    if(user && user.user_blacklist && user.user_blacklist === '0') {
      return false
    }
  } 
  return true
}

/**
 * 金额字段在库里是 varchar(50)，可能存在千分位、空格、空串。
 * 原实现用 parseInt，遇到 "19,850.00" 会解析成 19，"19850.00" 会截断小数，导致金额判断失真。
 */
const parseAmount = v => {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  let s = String(v).replace(/,/g, '').replace(/\s/g, '')
  if (!s) return 0
  let n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * 日期字段同样是 varchar，历史上存在 DD/MM/YYYY、YYYY-MM-DD 混用。
 */
const parseDateValue = v => {
  if (!v) return null
  if (moment.isMoment(v)) return v.clone()
  let s = String(v).trim()
  if (!s) return null
  let formats = ['DD/MM/YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD', 'DD-MM-YYYY', 'DD/MM/YY', 'YYYY-MM-DD HH:mm:ss']
  for (let f of formats) {
    let m = moment(s, f, true)
    if (m.isValid()) return m
  }
  let m = moment(s)
  return m.isValid() ? m : null
}

const DISCHARGE_CHECK_START = moment('2020-12-31', 'YYYY-MM-DD')

// 该箱应缴纳的超期费（已还箱取实际金额，未还箱取应收金额，两者取大容错）
const containerDueAmount = r => {
  return Math.max(
    parseAmount(r.invoice_containers_actually_return_overdue_amount),
    parseAmount(r.invoice_containers_empty_return_overdue_amount)
  )
}

// 该箱已抵扣金额（收据 + 减免）
const containerPaidAmount = r => {
  return parseAmount(r.invoice_containers_empty_return_overdue_amount_receipt) +
    parseAmount(r.invoice_containers_empty_return_overdue_deduction)
}

/**
 * 是否纳入超期费判定：
 * 1. 卸船时间必须晚于 2020/7/1（之前的未入系统，存在未核销情况，沿用原有 2020-12-31 口径）
 * 2. SOC 箱、拍卖箱不判断
 */
const isDemurrageCheckTarget = async (r, vesselCache) => {
  if (r.invoice_containers_type === 'S' || r.invoice_containers_auction === '1') {
    return false
  }
  let discharge = parseDateValue(r.invoice_containers_edi_discharge_date)
  if (!discharge && r.invoice_vessel_id) {
    let vessel = null
    if (vesselCache && vesselCache.has(r.invoice_vessel_id)) {
      vessel = vesselCache.get(r.invoice_vessel_id)
    } else {
      vessel = await tb_vessel.findOne({ where: { invoice_vessel_id: r.invoice_vessel_id } })
      if (vesselCache) vesselCache.set(r.invoice_vessel_id, vessel)
    }
    if (vessel) discharge = parseDateValue(vessel.invoice_vessel_ata)
  }
  if (!discharge) return false
  return discharge.isAfter(DISCHARGE_CHECK_START, 'day')
}

/**
 * 注意：不做“同一提单合计”抵扣。
 * 实际案例（NTWARI / COSU6424029090）：7 个箱里 4 个多收 750、3 个少收 330，
 * 提单合计恰好打平甚至多收 420，但少收的那 3 个箱是收据截止日之后才还箱的真实欠费。
 * 按提单净额算会把真实欠费抵掉，导致该拉黑的客户没被拉黑。
 */

// 规则分布名称：代码 → 规则序号 + 中文名称（导出清单、审计日志、任务日志统一用它核对
const BLACKLIST_RULE_NAME = {
  INVOICE_1: '规则①-已还箱超3天未结清(有减免)',
  INVOICE_2: '规则①-已还箱超3天未结清(收款不足)',
  INVOICE_3: '规则①-已还箱超3天未结清(无收据)',
  INVOICE_4: '规则②-未还箱免箱后超30天(已开票未付)',
  INVOICE_5: '规则②-未还箱免箱后超30天(无收据)',
  MNR_1: '修箱费-已开票未收据',
  UNUSUAL_1: '异常票-已开票未收据',
  SETTLED: '自动解除-超期费已结清或已付到覆盖日',
  MANUAL: '人工操作'
}

exports.getBlacklistRuleName = code => BLACKLIST_RULE_NAME[code] || null

// 黑名单原因代码 → 可读描述
const BLACKLIST_REASON_TEXT = {
  INVOICE_1: '已还箱超过3天宽限期，收据与减免合计少于应缴超期费',
  INVOICE_2: '已还箱超过3天宽限期，已收金额少于应缴超期费',
  INVOICE_3: '已还箱超过3天宽限期，尚未收到超期费收据',
  INVOICE_4: '未还箱，收据支付截止日期已过且超期超过30天，费用未付',
  INVOICE_5: '未还箱，超期超过30天且费用未付',
  MNR_1: '修箱费已开票但未收到收据',
  UNUSUAL_1: '异常票已开票但未收到收据'
}

/**
 * 写黑名单操作记录。日志失败不能影响业务，因此整体 try/catch。
 */
const writeBlacklistLog = async doc => {
  try {
    let amountStr = v => (v === null || v === undefined || v === '' ? null : String(v))
    await tb_blacklist_log.create({
      blacklist_customer_id: doc.customer_id,
      blacklist_customer_name: doc.customer_name || null,
      blacklist_action: doc.action,
      blacklist_source: doc.source,
      blacklist_reason_code: doc.reason_code || null,
      blacklist_rule_name: BLACKLIST_RULE_NAME[doc.reason_code] || null,
      blacklist_reason_text: doc.reason_text || null,
      blacklist_order_no: doc.order_no || null,
      blacklist_bl_no: doc.bl_no || null,
      blacklist_container_no: doc.container_no || null,
      blacklist_container_id: doc.container_id || null,
      blacklist_due_amount: amountStr(doc.due),
      blacklist_paid_amount: amountStr(doc.paid),
      blacklist_unpaid_amount: amountStr(doc.unpaid),
      blacklist_before_status: doc.before_status || null,
      blacklist_after_status: doc.after_status || null,
      blacklist_operator_id: doc.operator_id || null,
      blacklist_operator_name: doc.operator_name || '系统自动'
    })
    return true
  } catch (error) {
    logger.error('[blacklist-log] write failed: ' + error.stack)
    return false
  }
}

/**
 * 客户黑名单判定（只读，不写库）
 * settled 表示该客户超期费是否已全部结清，用于“解除黑名单必须已结清”的保护。
 */
exports.evaluateCustomerBlacklist = async user_id => {
  if (!user_id) return null

  let user = await tb_user.findOne({
    where: {
      user_id: user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (!user) return null

  // 只要可能有超期费就纳入：申报超期天数 / 当前超期天数 / 应缴金额 任一大于 0
  let queryStr = `SELECT * FROM tbl_zhongtan_invoice_containers
    WHERE state = 1 AND invoice_containers_customer_id = ?
      AND ((invoice_containers_actually_return_overdue_amount + 0) > 0
        OR (invoice_containers_empty_return_overdue_amount + 0) > 0
        OR (invoice_containers_current_overdue_days + 0) > 0
        OR (invoice_containers_empty_return_overdue_days + 0) > 0)`
  let result = await model.simpleSelect(queryStr, [user_id])
  result = result || []

  let queryMnrStr = `SELECT * FROM tbl_zhongtan_container_mnr_ledger WHERE state = 1 AND mnr_ledger_invoice_no IS NOT NULL AND mnr_ledger_receipt_no IS NULL AND mnr_ledger_corresponding_payer_id = ? `
  let mnrResult = await model.simpleSelect(queryMnrStr, [user_id])
  mnrResult = mnrResult || []

  let queryUnusualStr = `SELECT * FROM tbl_zhongtan_unusual_invoice WHERE state = 1 AND unusual_invoice_no IS NOT NULL AND unusual_receipt_no IS NULL AND unusual_invoice_party = ? `
  let unusualResult = await model.simpleSelect(queryUnusualStr, [user_id])
  unusualResult = unusualResult || []

  let shouldBlacklist = false
  let order = null
  let reasonCode = null
  let hit = null
  let details = []
  let vesselCache = new Map()

  for (let r of result) {
    if (!(await isDemurrageCheckTarget(r, vesselCache))) continue

    let due = containerDueAmount(r)
    let paid = containerPaidAmount(r)
    let reason = null

    // “已还箱”只认 EDI 还箱动态（actually_return_date，由 EdiMail 写入）。
    // empty_return_date 是开票基准日（未还箱时可能是预计还箱日），不能作为已还箱依据，
    // 否则规则②“免箱期后超期 30 天”的门槛会被绕过。
    let returnDate = parseDateValue(r.invoice_containers_actually_return_date)
    let receiptDate = parseDateValue(r.invoice_containers_empty_return_date_receipt)

    if (returnDate) {
      // 规则①：EDI 还箱动态已还箱，超过 3 天宽限期，滞期费未结清 → 拉黑
      let graceOver = moment().startOf('day').diff(returnDate.clone().startOf('day'), 'days') > 3
      if (graceOver && due > 0 && paid < due) {
        if (!r.invoice_containers_empty_return_overdue_amount_receipt) {
          reason = 'INVOICE_3'
        } else if (parseAmount(r.invoice_containers_empty_return_overdue_deduction) > 0) {
          reason = 'INVOICE_1'
        } else {
          reason = 'INVOICE_2'
        }
      }
    } else {
      // 规则②：未收到 EDI 还箱动态 → 免箱期后超期 30 天锁定；滞期费付到哪天就解锁到哪天，超过再锁。
      // 覆盖日不早于今天 = 已付到覆盖日，欠费尚未形成，跳过（下一次任务在覆盖日之后会重新判）。
      if (receiptDate && !moment().isAfter(receiptDate, 'day')) continue
      let overdueDays = Math.max(
        parseAmount(r.invoice_containers_empty_return_overdue_days),
        parseAmount(r.invoice_containers_current_overdue_days)
      )
      if (overdueDays > 30) {
        reason = receiptDate ? 'INVOICE_4' : 'INVOICE_5'
      }
    }

    if (!reason) continue

    shouldBlacklist = true
    order = reason + '_' + r.invoice_containers_id
    reasonCode = reason
    hit = {
      container_id: r.invoice_containers_id,
      container_no: r.invoice_containers_no,
      bl: r.invoice_containers_bl,
      order_no: r.invoice_containers_empty_return_date_receipt_no,
      reason: order,
      due: due,
      paid: paid
    }
    details.push(hit)
    break
  }

  if (!shouldBlacklist && mnrResult.length > 0) {
    shouldBlacklist = true
    order = 'MNR_1_' + mnrResult[0].container_mnr_ledger_id
    reasonCode = 'MNR_1'
    hit = {
      mnr_id: mnrResult[0].container_mnr_ledger_id,
      order_no: mnrResult[0].mnr_ledger_invoice_no,
      reason: order
    }
    details.push(hit)
  }

  if (!shouldBlacklist && unusualResult.length > 0) {
    shouldBlacklist = true
    order = 'UNUSUAL_1_' + unusualResult[0].unusual_invoice_id
    reasonCode = 'UNUSUAL_1'
    hit = {
      unusual_id: unusualResult[0].unusual_invoice_id,
      order_no: unusualResult[0].unusual_invoice_no,
      reason: order
    }
    details.push(hit)
  }

  // 是否已结清：按箱逐笔比对（已收+减免 vs 应缴），不做提单净额抵扣，且无未收据的修箱费/异常票。
  // 同一提单里箱间多收/少收互相抵消会掩盖真实欠费，业务口径是按箱清。
  let totalUnpaid = 0
  let unpaidDetails = []
  for (let r of result) {
    let due = containerDueAmount(r)
    if (due <= 0) continue
    // 规则②的解锁口径：未收到 EDI 还箱动态的箱，滞期费付到哪天就解锁到哪天，
    // 覆盖日不早于今天的不计入未结清。
    let covDate = parseDateValue(r.invoice_containers_empty_return_date_receipt)
    let hasEdiReturn = !!parseDateValue(r.invoice_containers_actually_return_date)
    if (!hasEdiReturn && covDate && !moment().isAfter(covDate, 'day')) continue
    let unpaidOne = due - containerPaidAmount(r)
    if (unpaidOne > 0.01) {
      totalUnpaid += unpaidOne
      unpaidDetails.push({
        container_id: r.invoice_containers_id,
        container_no: r.invoice_containers_no,
        due: due,
        paid: containerPaidAmount(r),
        unpaid: unpaidOne
      })
    }
  }
  totalUnpaid = Math.round(totalUnpaid * 100) / 100
  let settled = totalUnpaid <= 0.01 && mnrResult.length === 0 && unusualResult.length === 0

  return {
    user: user,
    shouldBlacklist: shouldBlacklist,
    order: order,
    reasonCode: reasonCode,
    hit: hit,
    settled: settled,
    totalUnpaid: totalUnpaid,
    unpaidDetails: unpaidDetails,
    details: details
  }
}

/**
 * 按判定结果落库，返回动作：blacklist / release / keep / manual_skip / none
 * 关键保护：只有“判定不需要拉黑”且“超期费已结清”时才自动解除黑名单。
 * 原实现只看当次判定结果，导致客户在还箱当日（未满 3 天宽限期）就被解除黑名单，
 * 而后续再无触发点，欠款就一直挂着不拉黑。
 */
exports.applyCustomerBlacklist = async (user_id, options) => {
  let apply = !!(options && options.apply)
  let operator = (options && options.operator) || null
  let ev = await exports.evaluateCustomerBlacklist(user_id)
  if (!ev) return { action: 'none' }

  let user = ev.user
  let beforeStatus = user.user_blacklist
  let prevOrder = user.blacklist_order
  if (user.blacklist_from !== GLBConfig.DISABLE) {
    // 人工锁定的客户，自动逻辑不再干预
    return { action: 'manual_skip', shouldBlacklist: ev.shouldBlacklist, settled: ev.settled, reasonCode: ev.reasonCode }
  }

  let logBase = {
    customer_id: user_id,
    customer_name: user.user_name,
    source: 'AUTO',
    operator_id: operator ? operator.user_id : null,
    operator_name: operator ? (operator.user_name || operator.user_id) : '系统自动',
    before_status: beforeStatus
  }

  if (beforeStatus === GLBConfig.DISABLE) {
    if (ev.shouldBlacklist) {
      if (apply) {
        user.user_blacklist = GLBConfig.ENABLE
        user.blacklist_order = ev.order
        await user.save()
        let h = ev.hit || {}
        await writeBlacklistLog(Object.assign({}, logBase, {
          action: 'LOCK',
          reason_code: ev.reasonCode,
          reason_text: BLACKLIST_REASON_TEXT[ev.reasonCode] || null,
          order_no: h.order_no || null,
          bl_no: h.bl || null,
          container_no: h.container_no || null,
          container_id: h.container_id || null,
          due: h.due,
          paid: h.paid,
          unpaid: h.due === undefined ? ev.totalUnpaid : Math.max(0, (h.due || 0) - (h.paid || 0)),
          after_status: GLBConfig.ENABLE
        }))
      }
      return { action: 'blacklist', order: ev.order, settled: ev.settled, reasonCode: ev.reasonCode }
    }
    return { action: 'none', settled: ev.settled }
  }

  if (!ev.shouldBlacklist && ev.settled) {
    if (apply) {
      user.user_blacklist = GLBConfig.DISABLE
      user.blacklist_order = null
      await user.save()
      await writeBlacklistLog(Object.assign({}, logBase, {
        action: 'UNLOCK',
        reason_code: 'SETTLED',
        reason_text: '超期费及修箱费/异常票已全部结清，自动解除',
        order_no: prevOrder || null,
        unpaid: 0,
        after_status: GLBConfig.DISABLE
      }))
    }
    return { action: 'release', settled: ev.settled, prev_order: prevOrder }
  }

  return { action: 'keep', shouldBlacklist: ev.shouldBlacklist, settled: ev.settled, unpaid: ev.totalUnpaid, reasonCode: ev.reasonCode }
}

/**
 * 检查客户是否有进口超期,并自动设置黑名单
 * @param {} user_id
 */
exports.importDemurrageCheck = async user_id => {
  if (!user_id) return
  try {
    let ret = await exports.applyCustomerBlacklist(user_id, { apply: true })
    if (ret.action === 'blacklist' || ret.action === 'release') {
      logger.info('[blacklist] auto ' + ret.action + ' ' + user_id + ' rule=' + (ret.reasonCode || '-') + '(' + (exports.getBlacklistRuleName(ret.reasonCode) || '-') + ') order=' + (ret.order || '') + ' settled=' + ret.settled)
    }
    return ret
  } catch (error) {
    logger.error('[blacklist] importDemurrageCheck failed ' + user_id + ' : ' + error.stack)
  }
}

/**
 * 全量对账兜底：每日按客户扫描一遍，收敛所有“该拉黑却没拉黑 / 该解除却没解除”的客户。
 * 之所以需要它：单箱事件触发（EDI 收箱、开票、收据）都是一次性的，
 * 一旦某个触发点因为条件不满足而跳过，后续就没有任何补判机会。
 * @param {Object} options { apply: true 才写库，默认只做 dry-run 打日志 }
 */
exports.autoBlacklistSweep = async options => {
  let apply = !!(options && options.apply)
  let stats = { scanned: 0, blacklisted: 0, released: 0, kept: 0, manual_skip: 0, errors: 0, rules: {} }
  let startedAt = Date.now()

  // 候选客户：有超期费可能性的箱 / 未收据的修箱费 / 未收据的异常票 / 当前处于黑名单的客户
  let queryStr = `
    SELECT DISTINCT invoice_containers_customer_id AS user_id FROM tbl_zhongtan_invoice_containers
    WHERE state = '1' AND invoice_containers_customer_id IS NOT NULL AND invoice_containers_customer_id <> ''
      AND ((invoice_containers_actually_return_overdue_amount + 0) > 0
        OR (invoice_containers_empty_return_overdue_amount + 0) > 0
        OR (invoice_containers_current_overdue_days + 0) > 0
        OR (invoice_containers_empty_return_overdue_days + 0) > 0)
    UNION
    SELECT DISTINCT mnr_ledger_corresponding_payer_id AS user_id FROM tbl_zhongtan_container_mnr_ledger
    WHERE state = '1' AND mnr_ledger_invoice_no IS NOT NULL AND mnr_ledger_receipt_no IS NULL
      AND mnr_ledger_corresponding_payer_id IS NOT NULL AND mnr_ledger_corresponding_payer_id <> ''
    UNION
    SELECT DISTINCT unusual_invoice_party AS user_id FROM tbl_zhongtan_unusual_invoice
    WHERE state = '1' AND unusual_invoice_no IS NOT NULL AND unusual_receipt_no IS NULL
      AND unusual_invoice_party IS NOT NULL AND unusual_invoice_party <> ''
    UNION
    SELECT user_id FROM tbl_common_user WHERE state = '1' AND user_blacklist = '1'
  `
  let customers = await model.simpleSelect(queryStr, [])
  customers = customers || []

  for (let c of customers) {
    stats.scanned++
    try {
      let ret = await exports.applyCustomerBlacklist(c.user_id, { apply: apply })
      let ruleName = BLACKLIST_RULE_NAME[ret.reasonCode]
      if (ruleName) stats.rules[ruleName] = (stats.rules[ruleName] || 0) + 1
      if (ret.action === 'blacklist') {
        stats.blacklisted++
        logger.info('[blacklist-sweep] ' + (apply ? '' : '[dry-run] ') + 'blacklist ' + c.user_id + ' rule=' + (ret.reasonCode || '-') + '(' + (ruleName || '-') + ') order=' + ret.order)
      } else if (ret.action === 'release') {
        stats.released++
        logger.info('[blacklist-sweep] ' + (apply ? '' : '[dry-run] ') + 'release ' + c.user_id + ' rule=' + (ruleName || 'SETTLED'))
      } else if (ret.action === 'keep') {
        stats.kept++
        logger.info('[blacklist-sweep] ' + (apply ? '' : '[dry-run] ') + 'keep ' + c.user_id + ' shouldBlacklist=' + ret.shouldBlacklist + ' settled=' + ret.settled + ' unpaid=' + ret.unpaid + ' rule=' + (ruleName || '-'))
      } else if (ret.action === 'manual_skip') {
        stats.manual_skip++
      }
    } catch (error) {
      stats.errors++
      logger.error('[blacklist-sweep] error ' + c.user_id + ' : ' + error.stack)
    }
  }

  stats.elapsed_ms = Date.now() - startedAt
  stats.apply = apply
  logger.info('[blacklist-sweep] finished ' + JSON.stringify(stats))
  return stats
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  let user = req.user
  let iu = await tb_uploadfile.findOne({
        where: {
          api_name: 'CustomerServer_temporary',
          uploadfile_name: fileInfo.name,
          state: GLBConfig.ENABLE,
        }
      });
  if(iu) {
    return common.error('import_16')
  } else {
    await tb_uploadfile.create({
      api_name: 'CustomerServer_temporary',
      user_id: user.user_id,
      uploadfile_index1: '0',
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.path
    })
  }
  return common.success(fileInfo)
}

exports.removeAttachmentAct = async req => {
  let doc = common.docValidate(req)
  let modiuser = await tb_user.findOne({
    where: {
      user_id: doc.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if(modiuser) {
    modiuser.user_attachment = _.remove(modiuser.user_attachment, doc.atta_path)
    await modiuser.save()
    return common.success(modiuser)
  }
  return common.success()
}