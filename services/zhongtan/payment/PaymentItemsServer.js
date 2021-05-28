const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_payment_items = model.zhongtan_payment_items

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_payment_items where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (payment_items_code like ? or payment_items_name like ?)'
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

  let addObj = await tb_payment_items.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ payment_items_code: doc.payment_items_code }, { payment_items_name: doc.payment_items_name }]
    }
  })
  if (addObj) {
    return common.error('discharge_port_02')
  }

  let obj = await tb_payment_items.create({
    payment_items_code: doc.payment_items_code,
    payment_items_name: doc.payment_items_name
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_payment_items.findOne({
    where: {
      payment_items_id: doc.old.payment_items_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_payment_items.findOne({
      where: {
        payment_items_id: {[Op.ne]: doc.old.payment_items_id},
        [Op.or]: [{ payment_items_code: doc.new.payment_items_code }, { payment_items_name: doc.new.payment_items_name }]
      }
    })
    if (updateObj) {
      return common.error('discharge_port_02')
    }

    obj.payment_items_code = doc.new.payment_items_code
    obj.payment_items_name = doc.new.payment_items_name
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('discharge_port_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_payment_items.findOne({
    where: {
      payment_items_id: doc.payment_items_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

  } else {
    return common.error('discharge_port_01')
  }
}
