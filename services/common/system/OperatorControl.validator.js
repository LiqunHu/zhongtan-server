const _ = require('lodash')
const Joi = require('joi')
const model = require('../../../app/model')

module.exports = {
  name: 'OperatorControl Services',
  apiList: {
    init: {
      name: '获取组相关信息',
      enname: 'OperatorControlinit',
      tags: ['OperatorControl'],
      path: '/api/common/system/OperatorControl/init',
      type: 'post',
      JoiSchema: {}
    },
    search: {
      name: '用户查询',
      enname: 'OperatorControlsearch',
      tags: ['OperatorControl'],
      path: '/api/common/system/OperatorControl/search',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          search_text: Joi.string()
            .empty('')
            .max(50),
          order: Joi.string()
            .empty('')
            .max(50),
          limit: Joi.number().integer(),
          offset: Joi.number().integer()
        })
      }
    },
    add: {
      name: '增加操作员',
      enname: 'OperatorControladd',
      tags: ['OperatorControl'],
      path: '/api/common/system/OperatorControl/add',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          user_username: Joi.string().max(50),
          user_email: Joi.string().max(50),
          user_phone: Joi.string()
            .empty('')
            .max(50),
          user_name: Joi.string()
            .empty('')
            .max(50),
          user_gender: Joi.string().max(2),
          user_address: Joi.string()
            .empty('')
            .max(100),
          user_zipcode: Joi.string()
            .empty('')
            .max(10),
          user_groups: Joi.array().items(Joi.number().integer())
        })
      }
    },
    modify: {
      name: '修改用户',
      enname: 'OperatorControlmodify',
      tags: ['OperatorControl'],
      path: '/api/common/system/OperatorControl/modify',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          new: Joi.object().keys(
            _.extend(_.omit(model.model2Schema(model.common_user), 'user_password'), {
              user_groups: Joi.array().items(Joi.number().integer())
            })
          ),
          old: Joi.object().keys(
            _.extend(_.omit(model.model2Schema(model.common_user), 'user_password'), {
              user_groups: Joi.array().items(Joi.number().integer())
            })
          )
        })
      }
    },
    delete: {
      name: '删除用户',
      enname: 'OperatorControldelete',
      tags: ['OperatorControl'],
      path: '/api/common/system/OperatorControl/delete',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          user_id: Joi.string().max(50)
        })
      }
    }
  }
}
