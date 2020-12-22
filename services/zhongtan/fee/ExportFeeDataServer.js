const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_fee_data = model.zhongtan_export_fee_data
const tb_container_size = model.zhongtan_container_size

exports.initAct = async () => {
  let siezes = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  let returnData = {
    CONTAINER_SIZE: siezes,
    FEE_TYPE: GLBConfig.INVOICE_DEFAULT_FEE_TYPE,
    FEE_CURRENCY: GLBConfig.RECEIPT_CURRENCY
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select * from tbl_zhongtan_export_fee_data where state = '1' `
  let replacements = []
  if (doc.fee_data_code) {
    queryStr += ' AND fee_data_code = ?'
    replacements.push(doc.fee_data_code)
  }
  if (doc.fee_data_name) {
    queryStr += ' AND fee_data_name like ?'
    replacements.push('%' + doc.fee_data_name + '%')
  }
  queryStr += ' ORDER BY fee_data_code'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = result.data
  return common.success(returnData)
}

exports.createAct = async req => {
  let doc = common.docValidate(req)
  if(doc.fee_data_type === 'BL') {
    let oldFee = await tb_fee_data.findOne({
      where: {
        fee_data_code: doc.fee_data_code,
        fee_data_type: doc.fee_data_type,
        state: GLBConfig.ENABLE
      }
    })
    if(oldFee) {
      return common.error('fee_01')
    }
    await tb_fee_data.create({
      fee_data_code: doc.fee_data_code,
      fee_data_name: doc.fee_data_name,
      fee_data_transit: doc.fee_data_transit,
      fee_data_type: doc.fee_data_type,
      fee_data_receivable: doc.fee_data_receivable,
      fee_data_receivable_fixed: doc.fee_data_receivable_fixed,
      fee_data_receivable_amount: doc.fee_data_receivable_amount,
      fee_data_receivable_amount_currency: doc.fee_data_receivable_amount_currency,
      fee_data_payable: doc.fee_data_payable,
      fee_data_payable_fixed: doc.fee_data_payable_fixed,
      fee_data_payable_amount: doc.fee_data_payable_amount,
      fee_data_payable_amount_currency: doc.fee_data_payable_amount_currency
    })
  } else {
    if(doc.fee_data_container_size_create && doc.fee_data_container_size_create.length > 0) {
      for(let cs of doc.fee_data_container_size_create) {
        let oldFee = await tb_fee_data.findOne({
          where: {
            fee_data_code: doc.fee_data_code,
            fee_data_container_size: cs,
            state: GLBConfig.ENABLE
          }
        })
        if(oldFee) {
          return common.error('fee_01')
        }
      }
    }
    if(doc.fee_data_container_size_create && doc.fee_data_container_size_create.length > 0) {
      for(let cs of doc.fee_data_container_size_create) {
        await tb_fee_data.create({
          fee_data_code: doc.fee_data_code,
          fee_data_name: doc.fee_data_name,
          fee_data_transit: doc.fee_data_transit,
          fee_data_type: doc.fee_data_type,
          fee_data_container_size: cs,
          fee_data_receivable: doc.fee_data_receivable,
          fee_data_receivable_fixed: doc.fee_data_receivable_fixed,
          fee_data_receivable_amount: doc.fee_data_receivable_amount,
          fee_data_receivable_amount_currency: doc.fee_data_receivable_amount_currency,
          fee_data_payable: doc.fee_data_payable,
          fee_data_payable_fixed: doc.fee_data_payable_fixed,
          fee_data_payable_amount: doc.fee_data_payable_amount,
          fee_data_payable_amount_currency: doc.fee_data_payable_amount_currency
        })
      }
    }
  }
  return common.success()
}

exports.updateAct = async req => {
  let doc = common.docValidate(req)
  let updateFee = await tb_fee_data.findOne({
    where: {
      fee_data_id: doc.new.fee_data_id,
      state: GLBConfig.ENABLE
    }
  })
  if(updateFee) {
    updateFee.fee_data_name = doc.new.fee_data_name
    updateFee.fee_data_transit = doc.new.fee_data_transit
    updateFee.fee_data_receivable = doc.new.fee_data_receivable
    updateFee.fee_data_receivable_fixed = doc.new.fee_data_receivable_fixed
    updateFee.fee_data_receivable_amount = doc.new.fee_data_receivable_amount
    updateFee.fee_data_payable = doc.new.fee_data_payable
    updateFee.fee_data_payable_fixed = doc.new.fee_data_payable_fixed
    updateFee.fee_data_payable_amount = doc.new.fee_data_payable_amount
    updateFee.updated_at = new Date()
    await updateFee.save()
  }
  return common.success()
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let updateFee = await tb_fee_data.findOne({
    where: {
      fee_data_id: doc.fee_data_id,
      state: GLBConfig.ENABLE
    }
  })
  if(updateFee) {
    updateFee.state = GLBConfig.DISABLE
    await updateFee.save()
  }
  return common.success()
}
