const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_bank_info = model.zhongtan_bank_info

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_bank_info where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (bank_code like ? or bank_name like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let addObj = await tb_bank_info.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ bank_code: doc.bank_code }, { bank_name: doc.bank_name }]
    }
  })
  if (addObj) {
    return common.error('bank_02')
  }

  let obj = await tb_bank_info.create({
    bank_code: doc.bank_code,
    bank_name: doc.bank_name,
    bank_remark: doc.bank_remark
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_bank_info.findOne({
    where: {
      bank_id: doc.old.bank_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_bank_info.findOne({
      where: {
        bank_id: {[Op.ne]: doc.old.bank_id},
        [Op.or]: [{ bank_code: doc.new.bank_code }, { bank_name: doc.new.bank_name }]
      }
    })
    if (updateObj) {
      return common.error('bank_02')
    }

    obj.bank_code = doc.new.bank_code
    obj.bank_name = doc.new.bank_name
    obj.bank_remark = doc.new.bank_remark
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('bank_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_bank_info.findOne({
    where: {
      bank_id: doc.bank_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

  } else {
    return common.error('bank_01')
  }
}