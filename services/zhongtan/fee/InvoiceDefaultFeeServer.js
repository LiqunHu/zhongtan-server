const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_default_fee = model.zhongtan_invoice_default_fee

exports.initAct = async () => {
  let returnData = {
    IM_FEE_NAME: GLBConfig.INVOICE_DEFAULT_IM_FEE_NAME,
    TR_FEE_NAME: GLBConfig.INVOICE_DEFAULT_TR_FEE_NAME,
    FEE_TYPE: GLBConfig.INVOICE_DEFAULT_FEE_TYPE,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    CARGO_TYPE: GLBConfig.INVOICE_CARGO_TYPE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select * from tbl_zhongtan_invoice_default_fee where state = '1' `
  let replacements = []
  if (doc.fee_cargo_type) {
    queryStr += ' AND fee_cargo_type = ?'
    replacements.push(doc.fee_cargo_type)
  }
  if (doc.fee_name) {
    queryStr += ' AND fee_name like ?'
    replacements.push('%' + doc.fee_name + '%')
  }
  queryStr += ' ORDER BY fee_cargo_type, fee_name, fee_container_size'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = result.data
  return common.success(returnData)
}

exports.createAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let oldFee = await tb_default_fee.findOne({
    where: {
      fee_cargo_type: doc.fee_cargo_type,
      fee_name: doc.fee_name,
      state: GLBConfig.ENABLE
    }
  })
  if(oldFee && ((oldFee.fee_type === 'BL') || (oldFee.fee_type === 'CON' && oldFee.fee_container_size === doc.fee_container_size))) {
    return common.error('fee_01')
  } else {
    await tb_default_fee.create({
      fee_cargo_type: doc.fee_cargo_type,
      fee_name: doc.fee_name,
      fee_type: doc.fee_type,
      fee_container_size: doc.fee_container_size,
      fee_amount: doc.fee_amount,
      fee_currency: doc.fee_currency,
      user_id: user.user_id
    })
  }
  return common.success()
}

exports.updateAct = async req => {
  let doc = common.docValidate(req)
  let updateFee = await tb_default_fee.findOne({
    where: {
      default_fee_id: doc.default_fee_id,
      state: GLBConfig.ENABLE
    }
  })
  if(updateFee) {
    updateFee.fee_amount = doc.new.fee_amount
    updateFee.updated_at = new Date()
    await updateFee.save()
  }
  return common.success()
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let updateFee = await tb_default_fee.findOne({
    where: {
      default_fee_id: doc.default_fee_id,
      state: GLBConfig.ENABLE
    }
  })
  if(updateFee) {
    updateFee.state = GLBConfig.DISABLE
    await updateFee.save()
  }
  return common.success()
}
