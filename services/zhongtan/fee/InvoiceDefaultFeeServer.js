const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_default_fee = model.zhongtan_invoice_default_fee
const tb_fee_config = model.zhongtan_invoice_fixed_fee_config
const tb_icd = model.zhongtan_icd

exports.initAct = async () => {
  let fee_config = await tb_fee_config.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  let im_fee = []
  let tr_fee = []
  if(fee_config) {
    for(let con of fee_config) {
      if(con.fee_cargo_type === 'IM') {
        im_fee.push({
          id: con.fee_id,
          text: con.fee_name
        })
      } else if(con.fee_cargo_type === 'TR') {
        tr_fee.push({
          id: con.fee_id,
          text: con.fee_name
        })
      }
    }
  }
  let icds = await tb_icd.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  let icd_list = []
  if(icds) {
    for(let icd of icds) {
      icd_list.push({
        id: icd.icd_code,
        text: icd.icd_code
      })
    }
  }
  let returnData = {
    IM_FEE_NAME: im_fee,
    TR_FEE_NAME: tr_fee,
    FEE_TYPE: GLBConfig.INVOICE_DEFAULT_FEE_TYPE,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    CARGO_TYPE: GLBConfig.INVOICE_CARGO_TYPE,
    POD: icd_list 
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
  let oldFees = await tb_default_fee.findAll({
    where: {
      fee_cargo_type: doc.fee_cargo_type,
      fee_name: doc.fee_name,
      state: GLBConfig.ENABLE
    }
  })
  let can_create = true
  if(oldFees) {
    for(let f of oldFees) {
      if(f.fee_type === 'BL') {
        can_create = false
        break
      } else {
        if(doc.fee_pol_mark) {
          if(f.fee_pol_mark) {
            let pms = doc.fee_pol_mark.split(',')
            for(let pm of pms) {
              if(pm) {
                if(f.fee_pol_mark.toUpperCase().indexOf(pm.toUpperCase()) >= 0) {
                  can_create = false
                  break
                }
              }
            }
          }
        } else if(f.fee_container_size === doc.fee_container_size && !f.fee_pol_mark) {
          can_create = false
          break
        }
      }
    }
  }
  if(!can_create) {
    return common.error('fee_01')
  } else {
    await tb_default_fee.create({
      fee_cargo_type: doc.fee_cargo_type,
      fee_name: doc.fee_name,
      fee_type: doc.fee_type,
      fee_container_size: doc.fee_container_size,
      fee_amount: doc.fee_amount,
      fee_currency: doc.fee_currency,
      user_id: user.user_id,
      is_necessary: doc.is_necessary ? GLBConfig.ENABLE : GLBConfig.DISABLE,
      fee_pol_mark: doc.fee_pol_mark,
      fee_pod: doc.fee_pod
    })
  }
  return common.success()
}

exports.updateAct = async req => {
  let doc = common.docValidate(req)
  let updateFee = await tb_default_fee.findOne({
    where: {
      default_fee_id: doc.new.default_fee_id,
      state: GLBConfig.ENABLE
    }
  })
  if(updateFee) {
    updateFee.fee_amount = doc.new.fee_amount
    if(doc.new.is_necessary) {
      updateFee.is_necessary = GLBConfig.ENABLE
    } else {
      updateFee.is_necessary = GLBConfig.DISABLE
    }
    updateFee.fee_pol_mark = doc.new.fee_pol_mark
    updateFee.fee_pod = doc.new.fee_pod
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
