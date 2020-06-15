const Joi = require('joi')

module.exports = {
  name: 'GroupControl Services',
  apiList: {
    init: {
      name: '获取组数据字典',
      enname: 'GroupControlinit',
      tags: ['GroupControl'],
      path: '/api/common/system/GroupControl/init',
      type: 'post',
      JoiSchema: {}
    },
    search: {
      name: '组查询',
      enname: 'GroupControlsearch',
      tags: ['GroupControl'],
      path: '/api/common/system/GroupControl/search',
      type: 'post',
      JoiSchema: {}
    },
    getcheck: {
      name: '获取组下拥有的菜单',
      enname: 'GroupControlgetcheck',
      tags: ['GroupControl'],
      path: '/api/common/system/GroupControl/getcheck',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          usergroup_id: Joi.number().integer()
        })
      }
    },
    add: {
      name: '增加目录或者节点',
      enname: 'GroupControladd',
      tags: ['GroupControl'],
      path: '/api/common/system/GroupControl/add',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          usergroup_name: Joi.string()
            .empty('')
            .max(50),
          node_type: Joi.string().max(2),
          parent_id: Joi.number().integer(),
          usergroup_code: Joi.string().max(50),
          menus: Joi.array().items(
            Joi.object().keys({
              systemmenu_id: Joi.number().integer()
            })
          )
        })
      }
    },
    modify: {
      name: '修改节点',
      enname: 'GroupControlmodify',
      tags: ['GroupControl'],
      path: '/api/common/system/GroupControl/modify',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          usergroup_id: Joi.number()
            .integer()
            .required(),
          usergroup_name: Joi.string()
            .empty('')
            .max(50),
          menus: Joi.array().items(
            Joi.object().keys({
              systemmenu_id: Joi.number().integer()
            })
          )
        })
      }
    },
    delete: {
      name: '删除组',
      enname: 'GroupControldelete',
      tags: ['GroupControl'],
      path: '/api/common/system/GroupControl/delete',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          usergroup_id: Joi.number().integer()
        })
      }
    }
  }
}
