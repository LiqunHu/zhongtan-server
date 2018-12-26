const common = require('../util/CommonUtil')
const GLBConfig = require('../util/GLBConfig')
const logger = require('../app/logger').createLogger(__filename)
const model = require('../app/model.js')

const tb_common_user = model.common_user
const tb_user_groups = model.common_user_groups
const tb_common_usergroup = model.common_usergroup
const tb_common_api = model.common_api
const tb_common_systemmenu = model.common_systemmenu

;(async () => {
  try {
    let menu = null
    let fmenuID1 = null
    let fmenuID2 = null
    let api = null
    let usergroup = null

    usergroup = await tb_common_usergroup.create({
      usergroup_name: 'administrator',
      usergroup_type: GLBConfig.TYPE_ADMINISTRATOR,
      node_type: '01',
      parent_id: 0
    })

    let user = await tb_common_user.create({
      user_type: GLBConfig.TYPE_ADMINISTRATOR,
      user_username: 'admin',
      user_name: 'admin',
      user_password: 'admin'
    })

    let user_groups = await tb_user_groups.create({
      user_id: user.user_id,
      usergroup_id: usergroup.usergroup_id
    })

    // common
    menu = await tb_common_systemmenu.create({
      systemmenu_name: 'common',
      systemmenu_icon: 'fa-cogs',
      node_type: '00',
      parent_id: '0'
    })
    fmenuID1 = menu.systemmenu_id

    menu = await tb_common_systemmenu.create({
      systemmenu_name: 'system',
      node_type: '00',
      parent_id: fmenuID1
    })
    fmenuID2 = menu.systemmenu_id
    api = await tb_common_api.create({
      api_name: '系统菜单维护',
      api_path: '/common/system/SystemApiControl',
      api_function: 'SYSTEMAPICONTROL',
      auth_flag: '1',
      show_flag: '1',
      api_kind: '1'
    })
    menu = await tb_common_systemmenu.create({
      systemmenu_name: api.api_name,
      api_id: api.api_id,
      api_function: api.api_function,
      node_type: '01',
      parent_id: fmenuID2
    })


    // api = await tb_common_api.create({
    //   api_name: '系统组权限维护',
    //   api_path: '/common/system/DomainGroupApiControl',
    //   api_function: 'DomainGROUPAPICONTROL',
    //   auth_flag: '1',
    //   show_flag: '1',
    //   api_kind: '1'
    // })
    // menu = await tb_common_systemmenu.create({
    //   systemmenu_name: api.api_name,
    //   api_id: api.api_id,
    //   api_function: api.api_function,
    //   node_type: '01',
    //   parent_id: fmenuID2
    // })
    api = await tb_common_api.create({
      api_name: '用户设置',
      api_path: '/common/system/UserSetting',
      api_function: 'USERSETTING',
      auth_flag: '1',
      show_flag: '0',
      api_kind: '1'
    })
    menu = await tb_common_systemmenu.create({
      systemmenu_name: api.api_name,
      api_id: api.api_id,
      api_function: api.api_function,
      node_type: '01',
      parent_id: fmenuID2
    })
    api = await tb_common_api.create({
      api_name: '角色设置',
      api_path: '/common/system/GroupControl',
      api_function: 'GROUPCONTROL',
      auth_flag: '1',
      show_flag: '1',
      api_kind: '1'
    })
    menu = await tb_common_systemmenu.create({
      systemmenu_name: api.api_name,
      api_id: api.api_id,
      api_function: api.api_function,
      node_type: '01',
      parent_id: fmenuID2
    })
    api = await tb_common_api.create({
      api_name: '用户维护',
      api_path: '/common/system/OperatorControl',
      api_function: 'OPERATORCONTROL',
      auth_flag: '1',
      show_flag: '1',
      api_kind: '1'
    })
    menu = await tb_common_systemmenu.create({
      systemmenu_name: api.api_name,
      api_id: api.api_id,
      api_function: api.api_function,
      node_type: '01',
      parent_id: fmenuID2
    })
    api = await tb_common_api.create({
      api_name: '重置密码',
      api_path: '/common/system/ResetPassword',
      api_function: 'RESETPASSWORD',
      auth_flag: '1',
      show_flag: '1',
      api_kind: '1'
    })
    menu = await tb_common_systemmenu.create({
      systemmenu_name: api.api_name,
      api_id: api.api_id,
      api_function: api.api_function,
      node_type: '01',
      parent_id: fmenuID2
    })

    process.exit(0)
  } catch (error) {
    console.log(error)
    process.exit(0)
  }
})()
