const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const Op = model.Op

const tb_container_size = model.zhongtan_container_size

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_container_size where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (container_size_code like ? or container_size_name like ?)'
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

  let addObj = await tb_container_size.findOne({
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ container_size_name: doc.container_size_name }, { container_size_code: doc.container_size_code }]
    }
  })
  if (addObj) {
    return common.error('container_size_02')
  }

  let obj = await tb_container_size.create({
    container_size_name: doc.container_size_name,
    container_size_code: doc.container_size_code
  })

  return common.success(obj)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_container_size.findOne({
    where: {
      container_size_id: doc.old.container_size_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    let updateObj = await tb_container_size.findOne({
      where: {
        container_size_id: {[Op.ne]: doc.old.container_size_id},
        [Op.or]: [{ container_size_name: doc.new.container_size_name }, { container_size_code: doc.new.container_size_code }]
      }
    })
    if (updateObj) {
      return common.error('container_size_02')
    }

    obj.container_size_name = doc.new.container_size_name
    obj.container_size_code = doc.new.container_size_code
    await obj.save()
    return common.success(obj)
  } else {
    return common.error('container_size_01')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_container_size.findOne({
    where: {
      container_size_id: doc.container_size_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()

  } else {
    return common.error('container_size_01')
  }
}

exports.changeSpecialAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_container_size.findOne({
    where: {
      container_size_id: doc.container_size_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.container_special_type = doc.container_special_type
    await obj.save()
    return common.success()
  } else {
    return common.error('operator_03')
  }
}