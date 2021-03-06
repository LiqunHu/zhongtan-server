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
    USER_CUSTOMER_TYPE: GLBConfig.USER_CUSTOMER_TYPE
  }
  let queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = 1 GROUP BY fee_data_code ORDER BY fee_data_code`
  let replacements = []
  returnData.EXPORT_SHIPMENTS= await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = 'select * from tbl_common_user where state = "1" and user_type = "' + GLBConfig.TYPE_CUSTOMER + '"'
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
  queryStr += ' order by user_blacklist desc, user_username'
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
      usergroup_code: 'CUSTOMER'
    }
  })

  if (usergroup) {
    let adduser = await tb_user.findOne({
      where: {
        state: GLBConfig.ENABLE,
        [Op.or]: [{ user_phone: doc.user_phone }, { user_username: doc.user_username.trim() }, { user_name: doc.user_name.trim() }]
      }
    })
    if (adduser) {
      return common.error('operator_02')
    }
    adduser = await tb_user.create({
      user_type: GLBConfig.TYPE_CUSTOMER,
      user_username: doc.user_username.trim(),
      user_email: doc.user_email.trim(),
      user_phone: doc.user_phone ? doc.user_phone.trim() : '',
      user_password: GLBConfig.INITPASSWORD,
      user_name: doc.user_name.trim(),
      user_gender: doc.user_gender,
      user_address: doc.user_address.trim(),
      user_address1: doc.user_address1,
      user_address2: doc.user_address2,
      user_zipcode: doc.user_zipcode,
      user_customer_type: doc.user_customer_type,
      user_tin: doc.user_tin ? doc.user_tin.trim() : '',
      user_vrn: doc.user_vrn ? doc.user_vrn.trim() : '',
      user_bank_account_usd: doc.user_bank_account_usd ? doc.user_bank_account_usd.trim() : '',
      user_bank_account_tzs: doc.user_bank_account_tzs ? doc.user_bank_account_tzs.trim() : '',
      export_split_shipment: doc.export_split_shipment ? doc.export_split_shipment : []
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
    modiuser.user_phone = doc.new.user_phone ? doc.new.user_phone.trim() : ''
    modiuser.user_name = doc.new.user_name.trim()
    modiuser.user_gender = doc.new.user_gender
    modiuser.user_avatar = doc.new.user_avatar
    modiuser.user_address = doc.new.user_address.trim()
    modiuser.user_address1 = doc.new.user_address1
    modiuser.user_address2 = doc.new.user_address2
    modiuser.user_state = doc.new.user_state
    modiuser.user_zipcode = doc.new.user_zipcode
    modiuser.user_customer_type = doc.new.user_customer_type
    modiuser.user_tin = doc.new.user_tin ? doc.new.user_tin.trim() : ''
    modiuser.user_vrn = doc.new.user_vrn ? doc.new.user_vrn.trim() : ''
    modiuser.user_bank_account_usd = doc.new.user_bank_account_usd ? doc.new.user_bank_account_usd.trim() : ''
    modiuser.user_bank_account_tzs = doc.new.user_bank_account_tzs ? doc.new.user_bank_account_tzs.trim() : ''
    modiuser.export_split_shipment = doc.new.export_split_shipment ? doc.new.export_split_shipment : []
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

exports.changeBlacklistAct = async req => {
  let doc = common.docValidate(req)
  let modiuser = await tb_user.findOne({
    where: {
      user_id: doc.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modiuser) {
    modiuser.user_blacklist = doc.user_blacklist
    await modiuser.save()
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.exportCustomerAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = 'select * from tbl_common_user where state = "1" and user_type = "' + GLBConfig.TYPE_CUSTOMER + '"'
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
  queryStr += ' order by user_blacklist desc, user_username'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []

  for (let r of result) {
    if(r.user_customer_type) {
      for(let t of GLBConfig.USER_CUSTOMER_TYPE) {
        if(r.user_customer_type === t.id) {
          r.user_customer_type_name = t.text
        }
      }
    }
    renderData.push(r)
  }

  let filepath = await common.ejs2xlsx('CustomerTemplate.xlsx', renderData)

  res.sendFile(filepath)
}