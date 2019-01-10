const redisClient = require('server-utils').redisClient

const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
const Op = model.Op

const tb_usergroup = model.common_usergroup
const tb_user = model.common_user
const tb_user_groups = model.common_user_groups

exports.initAct = async () => {
  let returnData = {
    VesselServiceINFO: GLBConfig.VesselServiceINFO
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = 'select * from tbl_common_user where state = "1" and user_type = "' + GLBConfig.TYPE_EMPLOYEE + '"'
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (user_username like ? or user_email like ? or user_phone like ? or user_name like ? or user_address like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let ap of result.data) {
    delete ap.user_password
    returnData.rows.push(ap)
  }

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let usergroup = await tb_usergroup.findOne({
    where: {
      usergroup_code: 'EMPLOYEE'
    }
  })

  if (usergroup) {
    let adduser = await tb_user.findOne({
      where: {
        [Op.or]: [{ user_phone: doc.user_phone }, { user_username: doc.user_username }]
      }
    })
    if (adduser) {
      return common.error('operator_02')
    }
    adduser = await tb_user.create({
      user_type: GLBConfig.TYPE_EMPLOYEE,
      user_username: doc.user_username,
      user_email: doc.user_email,
      user_phone: doc.user_phone,
      user_password: GLBConfig.INITPASSWORD,
      user_name: doc.user_name,
      user_gender: doc.user_gender,
      user_address: doc.user_address,
      user_zipcode: doc.user_zipcode,
      user_service_name: doc.user_service_name
    })

    await tb_user_groups.create({
      user_id: adduser.user_id,
      usergroup_id: usergroup.usergroup_id
    })

    let returnData = JSON.parse(JSON.stringify(adduser))
    delete returnData.user_password

    return common.success(returnData)
  } else {
    return common.error('customer_01')
  }
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let modiuser = await tb_user.findOne({
    where: {
      user_id: doc.old.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modiuser) {
    modiuser.user_email = doc.new.user_email
    modiuser.user_phone = doc.new.user_phone
    modiuser.user_name = doc.new.user_name
    modiuser.user_gender = doc.new.user_gender
    modiuser.user_avatar = doc.new.user_avatar
    modiuser.user_address = doc.new.user_address
    modiuser.user_state = doc.new.user_state
    modiuser.user_zipcode = doc.new.user_zipcode
    modiuser.user_service_name = doc.new.user_service_name
    await modiuser.save()

    let returnData = JSON.parse(JSON.stringify(modiuser))
    delete returnData.user_password
    logger.debug('modify success')
    return common.success(returnData)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let deluser = await tb_user.findOne({
    where: {
      user_id: doc.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (deluser) {
    deluser.state = GLBConfig.DISABLE
    await deluser.save()
    redisClient.del(['REDISKEYAUTH', 'WEB', deluser.user_id].join('_'))
    redisClient.del(['REDISKEYAUTH', 'MOBILE', deluser.user_id].join('_'))
    return common.success()
  } else {
    return common.error('operator_03')
  }
}
