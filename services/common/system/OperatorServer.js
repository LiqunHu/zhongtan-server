const redisClient = require('server-utils').redisClient

const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
const Op = model.Op

const tb_usergroup = model.common_usergroup
const tb_user = model.common_user
const tb_user_groups = model.common_user_groups

let groups = []

exports.initAct = async () => {
  let returnData = {}

  groups = []
  await genUserGroup('0', 0)
  returnData.groupInfo = groups

  logger.debug(returnData)

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = 'select * from tbl_common_user where state = "1" and user_type = "' + GLBConfig.TYPE_DEFAULT + '"'
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
    ap.user_groups = []
    let user_groups = await tb_user_groups.findAll({
      where: {
        user_id: ap.user_id
      }
    })
    for (let g of user_groups) {
      ap.user_groups.push(g.usergroup_id)
    }
    delete ap.user_password
    returnData.rows.push(ap)
  }

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let groupCheckFlag = true

  for (let gid of doc.user_groups) {
    let usergroup = await tb_usergroup.findOne({
      where: {
        usergroup_id: gid
      }
    })
    if (!usergroup) {
      groupCheckFlag = false
      break
    }
  }

  if (groupCheckFlag) {
    let adduser = await tb_user.findOne({
      where: {
        state: GLBConfig.ENABLE,
        [Op.or]: [{ user_phone: doc.user_phone }, { user_username: doc.user_username }, { user_code: doc.user_code }]
      }
    })
    if (adduser) {
      return common.error('operator_02')
    }
    adduser = await tb_user.create({
      user_type: GLBConfig.TYPE_DEFAULT,
      user_username: doc.user_username,
      user_email: doc.user_email,
      user_phone: doc.user_phone,
      user_password: GLBConfig.INITPASSWORD,
      user_name: doc.user_name,
      user_gender: doc.user_gender,
      user_address: doc.user_address,
      user_zipcode: doc.user_zipcode,
      user_code: doc.user_code
    })

    for (let gid of doc.user_groups) {
      await tb_user_groups.create({
        user_id: adduser.user_id,
        usergroup_id: gid
      })
    }

    let returnData = JSON.parse(JSON.stringify(adduser))
    delete returnData.user_password
    returnData.user_groups = doc.user_groups

    return common.success(returnData)
  } else {
    return common.error('operator_01')
  }
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let chkuser = await tb_user.findOne({
    where: {
      state: GLBConfig.ENABLE,
      [Op.or]: [{ user_phone: doc.new.user_phone }, { user_code: doc.new.user_code }],
      [Op.ne]: [{user_id: doc.old.user_id}]
    }
  })
  if (chkuser) {
    return common.error('operator_02')
  }

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
    modiuser.user_code = doc.new.user_code
    await modiuser.save()

    await tb_user_groups.destroy({
      where: {
        user_id: modiuser.user_id
      }
    })

    for (let gid of doc.new.user_groups) {
      await tb_user_groups.create({
        user_id: modiuser.user_id,
        usergroup_id: gid
      })
    }

    let returnData = JSON.parse(JSON.stringify(modiuser))
    delete returnData.user_password
    returnData.user_groups = doc.new.user_groups
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

const genUserGroup = async (parentId, lev) => {
  let actgroups = await tb_usergroup.findAll({
    where: {
      parent_id: parentId,
      usergroup_type: GLBConfig.TYPE_DEFAULT
    }
  })
  for (let g of actgroups) {
    if (g.node_type === GLBConfig.MTYPE_ROOT) {
      groups.push({
        id: g.usergroup_id,
        text: '--'.repeat(lev) + g.usergroup_name,
        disabled: true
      })
      await genUserGroup(g.usergroup_id, lev + 1)
    } else {
      groups.push({
        id: g.usergroup_id,
        text: '--'.repeat(lev) + g.usergroup_name
      })
    }
  }
}
