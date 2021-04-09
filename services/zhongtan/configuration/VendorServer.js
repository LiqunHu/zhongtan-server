const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_vendor = model.common_vendor

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryStr = 'select * from tbl_common_vendor where state = ?'
  let replacements = [GLBConfig.ENABLE]
  if (doc.search_text) {
    queryStr += ' and (vendor_code like ? or vendor_name like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
  }
  queryStr += ' order by vendor_code, vendor_name'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = result.data
  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let addVendor = await tb_vendor.findOne({
    where: {
      state: GLBConfig.ENABLE,
      [Op.or]: [{ vendor_code: doc.vendor_code }, { vendor_name: doc.vendor_name.trim() }]
    }
  })
  if (addVendor) {
    return common.error('operator_02')
  }
  await tb_vendor.create({
    vendor_code: doc.vendor_code,
    vendor_name: doc.vendor_name,
    vendor_email: doc.vendor_email,
    vendor_phone: doc.vendor_phone,
    vendor_address: doc.vendor_address,
    vendor_bank_name: doc.vendor_bank_name,
    vendor_bank_account: doc.vendor_bank_account,
    vendor_bank_address: doc.vendor_bank_address,
    vendor_swift_code: doc.vendor_swift_code
  })
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let modiVendor = await tb_vendor.findOne({
    where: {
      vendor_id: doc.old.vendor_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modiVendor) {
    let dbVendor = await tb_vendor.findOne({
      where: {
        state: GLBConfig.ENABLE,
        [Op.or]: [{ vendor_code: doc.new.vendor_code }, { vendor_name: doc.new.vendor_name.trim() }]
      }
    })
    if(dbVendor && dbVendor.vendor_id !== doc.old.vendor_id) {
      return common.error('operator_02')
    }
    modiVendor.vendor_code = doc.new.vendor_code
    modiVendor.vendor_name = doc.new.vendor_name
    modiVendor.vendor_email = doc.new.vendor_email
    modiVendor.vendor_phone = doc.new.vendor_phone
    modiVendor.vendor_address = doc.new.vendor_address
    modiVendor.vendor_bank_name = doc.new.vendor_bank_name
    modiVendor.vendor_bank_account = doc.new.vendor_bank_account
    modiVendor.vendor_bank_address = doc.new.vendor_bank_address
    modiVendor.vendor_swift_code = doc.new.vendor_swift_code
    await modiVendor.save()
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let delVendor = await tb_vendor.findOne({
    where: {
      vendor_id: doc.vendor_id,
      state: GLBConfig.ENABLE
    }
  })

  if (delVendor) {
    delVendor.state = GLBConfig.DISABLE
    await delVendor.save()
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.exportAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = 'select * from tbl_common_vendor where state = ?'
  let replacements = [GLBConfig.ENABLE]
  if (doc.search_text) {
    queryStr += ' and (vendor_code like ? or vendor_name like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
  }
  queryStr += ' order by vendor_code'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    renderData.push(r)
  }
  let filepath = await common.ejs2xlsx('VendorTemplate.xlsx', renderData)
  res.sendFile(filepath)
}