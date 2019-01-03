const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_container_manager = model.zhongtan_container_manager

exports.initAct = async () => {
  return common.success()
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_container_manager where state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (container_manager_name like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let container_manager = await tb_container_manager.create({
    container_manager_name: doc.container_manager_name,
    container_manager_email: doc.container_manager_email
  })

  logger.debug('add success')
  return common.success(container_manager)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let container_manager = await tb_container_manager.findOne({
    where: {
      container_manager_id: doc.old.container_manager_id,
      state: GLBConfig.ENABLE
    }
  })
  if (container_manager) {
    container_manager.container_manager_name = doc.new.container_manager_name
    container_manager.container_manager_email = doc.new.container_manager_email

    await container_manager.save()

    return common.success(container_manager)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let container_manager = await tb_container_manager.findOne({
    where: {
      container_manager_id: doc.old.container_manager_id,
      state: GLBConfig.ENABLE
    }
  })
  if (container_manager) {
    container_manager.state = GLBConfig.DISABLE
    await container_manager.save()

    return common.success()
  } else {
    return common.error('operator_03')
  }
}
