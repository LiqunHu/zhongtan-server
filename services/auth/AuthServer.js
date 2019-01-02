const _ = require('lodash')
const uuid = require('uuid')
const moment = require('moment')
const rp = require('request-promise')
const svgCaptcha = require('svg-captcha')
const redisClient = require('server-utils').redisClient
const authority = require('server-utils').authority
const smsClient = require('server-utils').smsClient

const common = require('../../util/CommonUtil.js')
const logger = require('../../app/logger').createLogger(__filename)
const model = require('../../app/model')
const config = require('../../app/config')
const GLBConfig = require('../../util/GLBConfig')

// table
const sequelize = model.sequelize
const tb_common_user = model.common_user
const tb_user_groups = model.common_user_groups

exports.signinAct = async req => {
  let doc = common.docValidate(req)
  let user

  if (doc.login_type === 'WEB' || doc.login_type === 'MOBILE') {
    user = await tb_common_user.findOne({
      where: {
        user_username: doc.username,
        state: GLBConfig.ENABLE
      }
    })

    if (_.isEmpty(user)) {
      return common.error('auth_05')
    }

    let decrypted = authority.aesDecryptModeCFB(doc.identify_code, user.user_password, doc.magic_no)

    if (!(decrypted == user.user_username)) {
      return common.error('auth_05')
    } else {
      let session_token = authority.user2token(doc.login_type, user, doc.magic_no)
      delete user.user_password
      let loginData = await loginInit(user, session_token, doc.login_type)

      if (loginData) {
        loginData.Authorization = session_token
        return common.success(loginData)
      } else {
        return common.error('auth_05')
      }
    }
  } else {
    return common.error('auth_19')
  }
}

exports.signinBySmsAct = async req => {
  let doc = common.docValidate(req)
  let user

  if (doc.login_type === 'WEB' || doc.login_type === 'MOBILE') {
    user = await tb_common_user.findOne({
      where: {
        user_phone: doc.user_phone,
        state: GLBConfig.ENABLE
      }
    })

    if (_.isEmpty(user)) {
      return common.error('auth_05')
    }

    let key = [config.redis.redisKey.SMS, user.user_phone].join('_')
    let rdsData = await redisClient.get(key)
    redisClient.del(key)

    if (_.isNull(rdsData)) {
      return common.error('auth_09')
    } else if (doc.code !== rdsData.code) {
      return common.error('auth_09')
    } else {
      let session_token = authority.user2token(doc.login_type, user, doc.code)
      delete user.user_password
      let loginData = await loginInit(user, session_token, doc.login_type)

      if (loginData) {
        loginData.Authorization = session_token
        return common.success(loginData)
      } else {
        return common.error('auth_05')
      }
    }
  } else {
    return common.error('auth_19')
  }
}

exports.signinByWxAct = async req => {
  let doc = common.docValidate(req)

  let url =
    'https://api.weixin.qq.com/sns/jscode2session?appid=' +
    config.weixin.appid +
    '&secret=' +
    config.weixin.app_secret +
    '&js_code=' +
    doc.wx_code +
    '&grant_type=authorization_code'
  let wxAuth = await rp(url)
  logger.debug(wxAuth)
  let wxAuthjs = JSON.parse(wxAuth)

  if (wxAuthjs.openid) {
    let user = await tb_common_user.findOne({
      where: {
        user_wx_openid: wxAuthjs.openid,
        state: GLBConfig.ENABLE
      }
    })
    if (!user) {
      return common.error('auth_22')
    }
    let session_token = authority.user2token('WEIXIN', user, common.generateRandomAlphaNum(6))
    user.session_key = wxAuthjs.session_key
    let loginData = await loginInit(user, session_token, doc.loginType)
    if (loginData) {
      loginData.Authorization = session_token
      return common.success(loginData)
    } else {
      return common.error('auth_05')
    }
  } else {
    return common.error('auth_21')
  }
}

exports.signoutAct = async req => {
  let token_str = req.get('Authorization')
  if (token_str) {
    let tokensplit = token_str.split('_')

    let type = tokensplit[0],
      uid = tokensplit[1]
    let error = await redisClient.del(config.redis.redisKey.AUTH + type + uid)
    if (error) {
      logger.error(error)
    }
  }
  return common.success()
}

exports.smsAct = async req => {
  let doc = common.docValidate(req)

  let user = await tb_common_user.findOne({
    where: {
      user_phone: doc.user_phone
    }
  })

  if (!user) {
    return common.error('auth_22')
  } else {
    let code = common.generateRandomAlphaNum(6)
    let smsExpiredTime = parseInt(config.SMS_TOKEN_AGE / 1000)
    let key = [config.redis.redisKey.SMS, user.user_phone].join('_')

    let liveTime = await redisClient.ttl(key)
    logger.debug(liveTime)
    logger.debug(code)
    if (liveTime > 0) {
      if (smsExpiredTime - liveTime < 70) {
        return common.error('auth_23')
      }
    }

    smsClient.sendMessageByTemplate(user.user_phone, '2HnuU1', {
      code: code
    })

    await redisClient.set(
      key,
      {
        code: code
      },
      smsExpiredTime
    )

    return common.success()
  }
}

exports.captchaAct = async () => {
  let captcha = svgCaptcha.create({
    size: 6,
    ignoreChars: '0o1i',
    noise: 2,
    color: true
  })

  let key = config.redis.redisKey.CAPTCHA + uuid.v1().replace(/-/g, '')
  await redisClient.set(
    key,
    {
      code: captcha.text
    },
    parseInt(config.CAPTCHA_TOKEN_AGE / 1000)
  )

  return common.success({ key: key, captcha: captcha.data })
}

const loginInit = async (user, session_token, type) => {
  try {
    let returnData = {}
    returnData.avatar = user.user_avatar
    returnData.user_id = user.user_id
    returnData.username = user.user_username
    returnData.name = user.user_name
    returnData.phone = user.user_phone
    returnData.created_at = moment(user.created_at).format('MM[, ]YYYY')
    returnData.city = user.user_city

    let groups = await tb_user_groups.findAll({
      where: {
        user_id: user.user_id
      }
    })

    if (groups.length > 0) {
      let gids = []
      groups.forEach(item => {
        gids.push(item.usergroup_id)
      })
      returnData.menulist = await iterationMenu(user, gids, '0')

      // prepare redis Cache
      let authApis = []
      if (user.user_type === GLBConfig.TYPE_ADMINISTRATOR) {
        authApis.push({
          api_name: '系统菜单维护',
          api_path: '/common/system/SystemApiControl',
          api_function: 'SYSTEMAPICONTROL',
          auth_flag: '1',
          show_flag: '1'
        })

        authApis.push({
          api_name: '用户设置',
          api_path: '/common/system/UserSetting',
          api_function: 'USERSETTING',
          auth_flag: '1',
          show_flag: '1'
        })

        authApis.push({
          api_name: '角色组维护',
          api_path: '/common/system/GroupControl',
          api_function: 'GROUPCONTROL',
          auth_flag: '1',
          show_flag: '1'
        })

        authApis.push({
          api_name: '用户维护',
          api_path: '/common/system/OperatorControl',
          api_function: 'OPERATORCONTROL',
          auth_flag: '1',
          show_flag: '1'
        })
      } else {
        let groupapis = await queryGroupApi(gids)
        for (let item of groupapis) {
          authApis.push({
            api_name: item.api_name,
            api_path: item.api_path,
            api_function: item.api_function,
            auth_flag: item.auth_flag,
            show_flag: item.show_flag
          })
        }
      }
      let expired = null
      if (type == 'MOBILE') {
        expired = parseInt(config.MOBILE_TOKEN_AGE / 1000)
      } else {
        expired = parseInt(config.TOKEN_AGE / 1000)
      }
      let error = await redisClient.set(
        [config.redis.redisKey.AUTH, type, user.user_id].join('_'),
        {
          session_token: session_token,
          user: user,
          authApis: authApis
        },
        expired
      )
      if (error) {
        return null
      }

      return returnData
    } else {
      return null
    }
  } catch (error) {
    logger.error(error)
    return null
  }
}

const queryGroupApi = async groups => {
  try {
    // prepare redis Cache
    let queryStr = `select DISTINCT c.api_name, c.api_path, c.api_function, c.auth_flag, c.show_flag 
          from tbl_common_usergroupmenu a, tbl_common_systemmenu b, tbl_common_api c
          where a.systemmenu_id = b.systemmenu_id
          and b.api_id = c.api_id
          and a.usergroup_id in (?)
          and b.state = '1'`

    let replacements = [groups]
    let groupmenus = await sequelize.query(queryStr, {
      replacements: replacements,
      type: sequelize.QueryTypes.SELECT
    })
    return groupmenus
  } catch (error) {
    logger.error(error)
    return []
  }
}

const iterationMenu = async (user, groups, parent_id) => {
  if (user.user_type === GLBConfig.TYPE_ADMINISTRATOR) {
    let return_list = []
    return_list.push({
      menu_type: GLBConfig.MTYPE_ROOT,
      menu_name: '管理员配置',
      menu_icon: 'fa-cogs',
      show_flag: '1',
      sub_menu: []
    })

    return_list[0].sub_menu.push({
      menu_type: GLBConfig.MTYPE_LEAF,
      menu_name: '系统菜单维护',
      show_flag: '1',
      menu_path: '/common/system/SystemApiControl'
    })

    return_list[0].sub_menu.push({
      menu_type: GLBConfig.MTYPE_LEAF,
      menu_name: '角色组维护',
      show_flag: '1',
      menu_path: '/common/system/GroupControl'
    })

    return_list[0].sub_menu.push({
      menu_type: GLBConfig.MTYPE_LEAF,
      menu_name: '用户维护',
      show_flag: '1',
      menu_path: '/common/system/OperatorControl'
    })

    return return_list
  } else {
    let return_list = []
    let queryStr = `select distinct b.systemmenu_id, b.node_type,b.systemmenu_name,b.systemmenu_icon, b.systemmenu_index, c.show_flag, c.api_path
        from tbl_common_usergroupmenu a, tbl_common_systemmenu b
          left join tbl_common_api c on b.api_id = c.api_id
          where a.systemmenu_id = b.systemmenu_id
          and a.usergroup_id in (?)
          and b.parent_id = ?
          order by b.systemmenu_index`

    let replacements = [groups, parent_id]
    let menus = await sequelize.query(queryStr, {
      replacements: replacements,
      type: sequelize.QueryTypes.SELECT
    })

    for (let m of menus) {
      let sub_menu = []

      if (m.node_type === GLBConfig.MTYPE_ROOT) {
        sub_menu = await iterationMenu(user, groups, m.systemmenu_id)
      }

      if (m.node_type === GLBConfig.MTYPE_LEAF) {
        return_list.push({
          menu_id: m.systemmenu_id,
          menu_type: m.node_type,
          menu_name: m.systemmenu_name,
          menu_path: m.api_path,
          menu_icon: m.systemmenu_icon,
          show_flag: m.show_flag
        })
      } else if (m.node_type === GLBConfig.MTYPE_ROOT && sub_menu.length > 0) {
        return_list.push({
          menu_id: m.systemmenu_id,
          menu_type: m.node_type,
          menu_name: m.systemmenu_name,
          menu_path: m.api_path,
          menu_icon: m.systemmenu_icon,
          show_flag: '1',
          sub_menu: sub_menu
        })
      }
    }
    return return_list
  }
}
