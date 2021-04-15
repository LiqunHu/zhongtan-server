const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_freight_place = model.zhongtan_freight_place

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_freight_place where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (freight_place_code like ? or freight_place_name like ?)'
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

  let addObj = await tb_freight_place.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ freight_place_name: doc.freight_place_name }, { freight_place_code: doc.freight_place_code }]
    }
  })
  if (addObj) {
    return common.error('discharge_port_02')
  }

  let obj = await tb_freight_place.create({
    freight_place_name: doc.freight_place_name,
    freight_place_code: doc.freight_place_code
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_freight_place.findOne({
    where: {
      freight_place_id: doc.old.freight_place_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_freight_place.findOne({
      where: {
        freight_place_id: {[Op.ne]: doc.old.freight_place_id},
        [Op.or]: [{ freight_place_name: doc.new.freight_place_name }, { freight_place_code: doc.new.freight_place_code }]
      }
    })
    if (updateObj) {
      return common.error('discharge_port_02')
    }

    obj.freight_place_name = doc.new.freight_place_name
    obj.freight_place_code = doc.new.freight_place_code
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('discharge_port_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_freight_place.findOne({
    where: {
      freight_place_id: doc.freight_place_id,
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
