const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')
const Op = model.Op

const tb_payment_advice = model.zhongtan_payment_advice
const tb_payment_verification = model.zhongtan_payment_verification
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {}
  returnData.RECEIPT_CURRENCY = GLBConfig.RECEIPT_CURRENCY
  returnData.PAYMENT_STATUS = GLBConfig.PAYMENT_STATUS
  returnData.PAYMENT_METHOD = GLBConfig.PAYMENT_METHOD
  let queryStr = `SELECT user_id, user_name, user_bank_account_usd, user_bank_account_tzs FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData.COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)

  queryStr = `SELECT payment_items_code, payment_items_name FROM tbl_zhongtan_payment_items WHERE state = '1' ORDER BY payment_items_code`
  replacements = []
  returnData.PAYMENT_ITEMS = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select pa.*, cb.user_name as payment_advice_beneficiary_name, cr.user_name as payment_advice_remarks_name, pi.payment_items_name as payment_advice_items_name
                  from tbl_zhongtan_payment_advice pa left join tbl_common_user cb on pa.payment_advice_beneficiary = cb.user_id 
                  left join tbl_common_user cr on pa.payment_advice_remarks = cr.user_id
                  left join tbl_zhongtan_payment_items pi on pa.payment_advice_items = pi.payment_items_code
                  where pa.state = '1' `
  let replacements = []

  let search_data = doc.search_data
  if(search_data) {
    if (search_data.payment_advice_no) {
      queryStr += ' and payment_advice_no like ?'
      replacements.push('%' + search_data.payment_advice_no + '%')
    }
  
    if (search_data.payment_advice_method) {
      queryStr += ' and payment_advice_method = ?'
      replacements.push(search_data.payment_advice_method)
    }
  
    if (search_data.payment_advice_items) {
      queryStr += ' and payment_advice_items = ?'
      replacements.push(search_data.payment_advice_items)
    }
  
    if (search_data.payment_advice_inv_cntrl) {
      queryStr += ' and payment_advice_inv_cntrl like ? '
      replacements.push('%' +search_data.payment_advice_inv_cntrl + '%')
    }
  
    if (search_data.payment_advice_beneficiary) {
      queryStr += ' and payment_advice_beneficiary = ?'
      replacements.push(search_data.payment_advice_beneficiary)
    }
  
    if (search_data.payment_advice_remarks) {
      queryStr += ' and payment_advice_remarks = ?'
      replacements.push(search_data.payment_advice_remarks)
    }
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      if(d.payment_advice_status === '2') {
        d.advice_files = await tb_uploadfile.findOne({
          where: {
            uploadfile_index1: d.payment_advice_id,
            api_name: 'PAYMENT ADVICE',
            state: GLBConfig.ENABLE
          }
        })
      } else {
        d.payment_advice_check = false
        let count = await tb_payment_verification.count({
          where: {
            payment_advice_id: d.payment_advice_id,
            payment_verification_state: 'PM',
            state: GLBConfig.ENABLE
          }
        })
        if(count > 0) {
          d.payment_advice_check = true
        }
      }
      rows.push(d)
    }
  }
  returnData.rows = rows

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req), user = req.user

  let addObj = await tb_payment_advice.findOne({
    where: {
      state : GLBConfig.ENABLE,
      payment_advice_inv_cntrl: doc.payment_advice_inv_cntrl
    }
  })
  if (addObj) {
    return common.error('payment_01')
  }

  let obj = await tb_payment_advice.create({
    payment_advice_method: doc.payment_advice_method,
    payment_advice_items: doc.payment_advice_items,
    payment_advice_inv_cntrl: doc.payment_advice_inv_cntrl,
    payment_advice_beneficiary: doc.payment_advice_beneficiary,
    payment_advice_amount: doc.payment_advice_amount,
    payment_advice_currency: doc.payment_advice_currency,
    payment_advice_bank_account: doc.payment_advice_bank_account,
    payment_advice_remarks: doc.payment_advice_remarks,
    payment_advice_status: '1'
  })

  await tb_payment_verification.create({
    payment_advice_id: obj.payment_advice_id,
    payment_verification_state: 'PB',
    payment_verification_create_user: user.user_id
  })
  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_payment_advice.findOne({
    where: {
      payment_advice_id: doc.old.payment_advice_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let ver = await tb_payment_verification.findOne({
      where: {
        payment_advice_id: doc.old.payment_advice_id
      },
      order: [['payment_verification_id', 'DESC']]
    })
    if(ver && (ver.payment_verification_state === 'PM' || ver.payment_verification_state === 'AP')) {
      return common.error('payment_03')
    }
    let updateObj = await tb_payment_advice.findOne({
      where: {
        state : GLBConfig.ENABLE,
        payment_advice_id: {[Op.ne]: doc.old.payment_advice_id},
        payment_advice_inv_cntrl: doc.new.payment_advice_inv_cntrl
      }
    })
    if (updateObj) {
      return common.error('payment_01')
    }
    obj.payment_advice_method = doc.new.payment_advice_method
    obj.payment_advice_items = doc.new.payment_advice_items
    obj.payment_advice_inv_cntrl = doc.new.payment_advice_inv_cntrl
    obj.payment_advice_beneficiary = doc.new.payment_advice_beneficiary
    obj.payment_advice_amount = doc.new.payment_advice_amount
    obj.payment_advice_currency = doc.new.payment_advice_currency
    obj.payment_advice_bank_account = doc.new.payment_advice_bank_account
    obj.payment_advice_remarks = doc.new.payment_advice_remarks
    await obj.save()

    if(ver) {
      ver.payment_verification_state = 'PB'
      await ver.save()
    }
    return common.success(obj)
  } else {
    return common.error('payment_02')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_payment_advice.findOne({
    where: {
      payment_advice_id: doc.payment_advice_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    if(obj.payment_advice_status === '2') {
      return common.error('payment_04')
    }
    obj.state = GLBConfig.DISABLE
    await obj.save()

    let vers = await tb_payment_verification.findAll({
      where: {
        payment_advice_id: doc.payment_advice_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vers) {
      for(let v of vers) {
        v.state = GLBConfig.DISABLE
        await v.save()
      }
    }
  } else {
    return common.error('payment_02')
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

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `select pa.*, cb.user_name as payment_advice_beneficiary_name, cr.user_name as payment_advice_remarks_name, pi.payment_items_name as payment_advice_items_name
                  from tbl_zhongtan_payment_advice pa left join tbl_common_user cb on pa.payment_advice_beneficiary = cb.user_id 
                  left join tbl_common_user cr on pa.payment_advice_remarks = cr.user_id
                  left join tbl_zhongtan_payment_items pi on pa.payment_advice_items = pi.payment_items_code
                  where pa.state = '1' `
  let replacements = []
  let search_data = doc.search_data
  if(search_data) {
    if (search_data.payment_advice_no) {
      queryStr += ' and payment_advice_no like ?'
      replacements.push('%' +doc.payment_advice_no + '%')
    }
  
    if (search_data.payment_advice_method) {
      queryStr += ' and payment_advice_method = ?'
      replacements.push(doc.payment_advice_method)
    }
  
    if (search_data.payment_advice_items) {
      queryStr += ' and payment_advice_items = ?'
      replacements.push(doc.payment_advice_items)
    }
  
    if (search_data.payment_advice_inv_cntrl) {
      queryStr += ' and payment_advice_inv_cntrl like ? '
      replacements.push('%' +doc.payment_advice_inv_cntrl + '%')
    }
  
    if (search_data.payment_advice_beneficiary) {
      queryStr += ' and payment_advice_beneficiary = ?'
      replacements.push(doc.payment_advice_beneficiary)
    }
  
    if (search_data.payment_advice_remarks) {
      queryStr += ' and payment_advice_remarks = ?'
      replacements.push(doc.payment_advice_remarks)
    }
  }
  let result = await model.simpleSelect(queryStr, replacements)
  let filepath = await common.ejs2xlsx('PaymentAdvice.xlsx', result)
  res.sendFile(filepath)
}