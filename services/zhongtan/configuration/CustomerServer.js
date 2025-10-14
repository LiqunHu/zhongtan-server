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
    modiuser.user_blacklist = doc.user_blacklist
    if(doc.user_blacklist === GLBConfig.ENABLE) {
      modiuser.blacklist_from = GLBConfig.ENABLE
    } else {
      modiuser.blacklist_from = GLBConfig.DISABLE
    }
    await modiuser.save()
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
 * 检查客户是否有进口超期,并自动设置黑名单
 * @param {} user_id 
 */
exports.importDemurrageCheck = async user_id => {
  let user = await tb_user.findOne({
    where: {
      user_id: user_id,
      blacklist_from: GLBConfig.DISABLE,
      state: GLBConfig.ENABLE
    }
  })
  if(user) {
    let queryStr = `SELECT * FROM tbl_zhongtan_invoice_containers WHERE state = 1 AND invoice_containers_customer_id = ? AND invoice_containers_empty_return_overdue_days > 0 `
    let replacements = [user_id]
    let result = await model.simpleSelect(queryStr, replacements)
    
    let queryMnrStr = `SELECT * FROM tbl_zhongtan_container_mnr_ledger WHERE state = 1 AND mnr_ledger_invoice_no IS NOT NULL AND mnr_ledger_receipt_no IS NULL AND mnr_ledger_corresponding_payer_id = ? `
    let mnrReplacements = [user_id]
    let mnrResult = await model.simpleSelect(queryMnrStr, mnrReplacements)

    let queryUnusualStr = `SELECT * FROM tbl_zhongtan_unusual_invoice WHERE state = 1 AND unusual_invoice_no IS NOT NULL AND unusual_receipt_no IS NULL AND unusual_invoice_party = ? `
    let unusualReplacements = [user_id]
    let unusualResult = await model.simpleSelect(queryUnusualStr, unusualReplacements)

    if((result && result.length > 0) || (mnrResult && mnrResult.length > 0) || (unusualResult && unusualResult.length > 0)) {
      let user_blacklist = GLBConfig.DISABLE
      let blacklist_order = null
      if(result && result.length > 0) {
        for(let r of result) {
          try {
            // 1. 从卸船时间2020/7/1日开始，之前的没入系统，存在未核销的情况
            let check_flg = false
            if(r.invoice_containers_edi_discharge_date && moment(r.invoice_containers_edi_discharge_date, 'DD/MM/YYYY').isAfter(moment('31/12/2020', 'DD/MM/YYYY'), 'day')) {
              check_flg = true
            } else if(r.invoice_vessel_id){
              let vessel = await tb_vessel.findOne({
                where: {
                  invoice_vessel_id: r.invoice_vessel_id
                }
              })
              if(vessel && vessel.invoice_vessel_ata && moment(vessel.invoice_vessel_ata, 'DD/MM/YYYY').isAfter(moment('31/12/2020', 'DD/MM/YYYY'), 'day')) {
                check_flg = true
              }
            }
            if(r.invoice_containers_type === 'S' || r.invoice_containers_auction === '1') {
              // SOC箱不判断 拍卖箱不判断
              check_flg = false
            }
            if(check_flg) {
              // 2. 针对已还箱- 产生滞期费- 未全额支付的- 自动拉黑  （EDI收箱日期+3天）
              if(r.invoice_containers_actually_return_date) {
                if(moment().diff(moment(r.invoice_containers_actually_return_date, 'DD/MM/YYYY'), 'days') > 3) {
                  if(r.invoice_containers_empty_return_overdue_amount_receipt) {
                    if(r.invoice_containers_empty_return_overdue_deduction) {
                      if((parseInt(r.invoice_containers_empty_return_overdue_amount_receipt) + parseInt(r.invoice_containers_empty_return_overdue_deduction)) < parseInt(r.invoice_containers_actually_return_overdue_amount)) {
                        user_blacklist = GLBConfig.ENABLE
                        blacklist_order = 'INVOICE_1_' + r.invoice_containers_id
                      } 
                    } else if(parseInt(r.invoice_containers_empty_return_overdue_amount_receipt) < parseInt(r.invoice_containers_actually_return_overdue_amount)){
                      user_blacklist = GLBConfig.ENABLE
                      blacklist_order = 'INVOICE_2_' + r.invoice_containers_id
                    }
                  } else {
                    user_blacklist = GLBConfig.ENABLE
                    blacklist_order = 'INVOICE_3_' + r.invoice_containers_id
                    break
                  }
                }
              } else {
                // 3. 针对未还箱，在免箱天基础上超期超过30天、产生滞期费- 未支付到一定日期- 自动拉黑 
                //（即免箱期内超期30天未还箱，例如超期第30天到12/1日，需开票支付到12/1日，开具收据后系统移除黑名单至支付截止日期12/1，费用未支付或到12/2号未还，费用未支付，自动拉黑）
                if(r.invoice_containers_empty_return_date_receipt) {
                  // 已经开收据
                  if(moment().isAfter(moment(r.invoice_containers_empty_return_date_receipt, 'DD/MM/YYYY'), 'day') && parseInt(r.invoice_containers_empty_return_overdue_days) > 30) {
                    // 开票日期在当前日期之前,并且超期大于30天
                    user_blacklist = GLBConfig.ENABLE
                    blacklist_order = 'INVOICE_4_' + r.invoice_containers_id
                    break
                  }
                } else if(parseInt(r.invoice_containers_empty_return_overdue_days) > 30){
                  user_blacklist = GLBConfig.ENABLE
                  blacklist_order = 'INVOICE_5_' + r.invoice_containers_id
                  break
                }
              }
              if(user_blacklist === GLBConfig.ENABLE) {
                // 如果需要拉黑,则查该箱提单号下所有的箱子,合计判断
                let queryBlStr = `SELECT * FROM tbl_zhongtan_invoice_containers WHERE state = 1 AND invoice_vessel_id = ? AND invoice_containers_bl = ? `
                let blReplacements = [r.invoice_vessel_id, r.invoice_containers_bl]
                let blResult = await model.simpleSelect(queryBlStr, blReplacements) 
                if(blResult && blResult.length > 0) {
                  let totalReceiptAmount = 0
                  let totalDemurrageAmount = 0
                  for(let bl of blResult) {
                    if(bl.invoice_containers_actually_return_date && bl.invoice_containers_empty_return_overdue_amount_receipt) {
                      totalReceiptAmount += parseInt(bl.invoice_containers_empty_return_overdue_amount_receipt)
                      if(bl.invoice_containers_empty_return_overdue_deduction) {
                        totalReceiptAmount += parseInt(bl.invoice_containers_empty_return_overdue_deduction)
                      }
                      totalDemurrageAmount += parseInt(bl.invoice_containers_actually_return_overdue_amount)
                    }
                  }
                  if(totalReceiptAmount >= totalDemurrageAmount) {
                    user_blacklist = GLBConfig.DISABLE
                    blacklist_order = null
                  }
                }
                if(user_blacklist === GLBConfig.ENABLE) {
                  break
                }
              }
            }
          } catch(error) {
            console.error(error)
          }
        }
      }
      if(user_blacklist === GLBConfig.DISABLE) {
        // 查询修箱费
        if(mnrResult && mnrResult.length > 0) {
          user_blacklist = GLBConfig.ENABLE
          blacklist_order = 'MNR_1_' + mnrResult[0].container_mnr_ledger_id
        }
      }

      if(user_blacklist === GLBConfig.DISABLE) {
        // 查询修箱费
        if(unusualResult && unusualResult.length > 0) {
          user_blacklist = GLBConfig.ENABLE
          blacklist_order = 'UNUSUAL_1_' + unusualResult[0].unusual_invoice_id
        }
      }

      if(user.user_blacklist === GLBConfig.DISABLE) {
        if(user_blacklist === GLBConfig.ENABLE) {
          user.user_blacklist = GLBConfig.ENABLE
          user.blacklist_order = blacklist_order
          await user.save()
        }
      } else {
        if(user_blacklist === GLBConfig.DISABLE) {
          user.user_blacklist = GLBConfig.DISABLE
          await user.save()
        }
      }
    } else {
      if(user.user_blacklist === GLBConfig.ENABLE) {
        user.user_blacklist = GLBConfig.DISABLE
        await user.save()
      }
    }
  }
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