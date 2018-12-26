const Joi = require('joi')

module.exports = {
  name: 'UserSetting Services',
  apiList: {
    changePassword: {
      name: '修改密码',
      enname: 'UserSettingChangePassword',
      tags: ['UserSetting'],
      path: '/api/common/system/UserSetting/changePassword',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          old_password: Joi.string(),
          password: Joi.string()
        })
      }
    }
  }
}
