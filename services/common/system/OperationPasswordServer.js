const common = require('../../../util/CommonUtil')
const CryptoJS = require('crypto-js')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const srv = require('./SystemApiServer')

const tb_pa = model.zhongtan_operation_password
const tb_user = model.common_user

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = `select p.*, m.systemmenu_name from tbl_zhongtan_operation_password p left join tbl_common_systemmenu m on p.operation_page = m.systemmenu_id where p.state = '1' `
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (p.operation_desc like ? or p.operation_page like ? or p.operation_action like ? )'
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

exports.searchPageAct = async req => {
  return await srv.searchAct(req)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let menuId = doc.menuId
  let action = doc.operation_action
  let desc = doc.operation_desc
  let password = doc.operation_password
  let pas = await tb_pa.findOne({
    where: {
      state: GLBConfig.ENABLE,
      operation_page: menuId,
      operation_action: action
    }
  })
  if(pas) {
    pas.operation_desc = desc
    pas.operation_password = password
    await pas.save()
  } else {
    pas = await tb_pa.create({
      operation_desc: desc,
      operation_page: menuId,
      operation_action: action,
      operation_password: password
    })
  }
  return common.success(pas)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let pas = await tb_pa.findOne({
    where: {
      state: GLBConfig.ENABLE,
      operation_password_id: doc.operation_password_id
    }
  })
  if(pas) {
    pas.operation_desc = doc.operation_desc
    pas.operation_password = doc.operation_password
    await pas.save()
  } 
  return common.success()
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let pas = await tb_pa.findOne({
    where: {
      state: GLBConfig.ENABLE,
      operation_password_id: doc.operation_password_id
    }
  })

  if (pas) {
    pas.state = GLBConfig.DISABLE
    await pas.save()
  } 
  return common.success()
}

exports.checkPassword = async (page, action, password) => {
  let queryStr = `select p.* from tbl_zhongtan_operation_password p left join tbl_common_systemmenu m on p.operation_page = m.systemmenu_id where p.state = '1' AND m.systemmenu_name = ? AND operation_action = ?`
  let replacements = [page, action]
  let pass = await model.simpleSelect(queryStr, replacements)
  if(pass && pass.length > 0) {
    if(CryptoJS.MD5(pass[0].operation_password).toString() === password) {
      return true
    }
  } else {
    let adminUser = await tb_user.findOne({
      where: {
        user_username: 'admin'
      }
    })
    if(adminUser.user_password === password) {
      return true
    }
  }
  return false
}

