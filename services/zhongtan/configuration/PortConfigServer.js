const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_port = model.zhongtan_port

exports.initAct = async () => {
  let returnData = {
  }
  logger.debug(returnData)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_port where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (port_name like ? or port_name_cn like ? or port_code like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
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

  let port = await tb_port.create({
    port_country: doc.port_country,
    port_name: doc.port_name,
    port_name_cn: doc.port_name_cn,
    port_code: doc.port_code
  })

  return common.success(port)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let port = await tb_port.findOne({
    where: {
      port_id: doc.old.port_id,
      state: GLBConfig.ENABLE
    }
  })
  if (port) {
    port.port_country = doc.new.port_country
    port.port_name = doc.new.port_name
    port.port_name_cn = doc.new.port_name_cn
    port.port_code = doc.new.port_code

    await port.save()

    return common.success(port)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let port = await tb_port.findOne({
    where: {
      port_id: doc.port_id,
      state: GLBConfig.ENABLE
    }
  })
  if (port) {
    port.state = GLBConfig.DISABLE
    await port.save()

    return common.success()
  } else {
    return common.error('operator_03')
  }
}
