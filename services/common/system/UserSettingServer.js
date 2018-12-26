const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_user = model.common_user

exports.changePasswordAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  if (user.user_password != doc.old_password) {
    return common.error('usersetting_01')
  }

  let modiuser = await tb_user.findOne({
    where: {
      user_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (modiuser) {
    modiuser.user_password = doc.password
    await modiuser.save()
    logger.debug('modisuccess')
    return common.success()
  } else {
    return common.error('usersetting_02')
  }
}
