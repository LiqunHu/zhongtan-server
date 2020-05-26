const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_container_type = model.zhongtan_container_type

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_container_type where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (container_type_code like ? or container_type_name like ?)'
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

  let addObj = await tb_container_type.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ container_type_name: doc.container_type_name }, { container_type_code: doc.container_type_code }]
    }
  })
  if (addObj) {
    return common.error('container_type_02')
  }

  let obj = await tb_container_type.create({
    container_type_name: doc.container_type_name,
    container_type_code: doc.container_type_code
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_container_type.findOne({
    where: {
      container_type_id: doc.old.container_type_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_container_type.findOne({
      where: {
        container_type_id: {[Op.ne]: doc.old.container_type_id},
        [Op.or]: [{ container_type_name: doc.new.container_type_name }, { container_type_code: doc.new.container_type_code }]
      }
    })
    if (updateObj) {
      return common.error('container_type_02')
    }

    obj.container_type_name = doc.new.container_type_name
    obj.container_type_code = doc.new.container_type_code
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('container_type_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_container_type.findOne({
    where: {
      container_type_id: doc.container_type_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

  } else {
    return common.error('container_type_01')
  }
}
