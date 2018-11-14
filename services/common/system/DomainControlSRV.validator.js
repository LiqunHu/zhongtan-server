const Joi = require('joi')
const model = require('../../../model')

module.exports = {
  name: 'DomainControl Services',
  apiList: {
    init: {
      name: '获取机构数据字典',
      enname: 'DomainControlinit',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/init',
      type: 'post',
      JoiSchema: {}
    },
    search: {
      name: '机构查询',
      enname: 'DomainControlsearch',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/search',
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
    addAct: {
      name: '机构增加',
      enname: 'DomainControladd',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/add',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          domain: Joi.string().max(50),
          domaintemplate_id: Joi.number().integer(),
          domain_name: Joi.string().max(50),
          domain_province: Joi.string().max(50),
          domain_city: Joi.string().max(50),
          domain_district: Joi.string().max(50),
          domain_address: Joi.string().max(50),
          domain_contact: Joi.string().max(50),
          domain_phone: Joi.string().max(50),
          domain_description: Joi.string().max(500)
        })
      }
    },
    modify: {
      name: '机构修改',
      enname: 'DomainControlmodify',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/modify',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          new: Joi.object().keys(model.model2Schema(model.common_domain)),
          old: Joi.object().keys(model.model2Schema(model.common_domain))
        })
      }
    },
    searchDomainMenu: {
      name: '查询机构菜单',
      enname: 'DomainControlsearchDomainMenu',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/searchDomainMenu',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          domain_id: Joi.number()
            .integer()
            .required()
        })
      }
    },
    modifyFolder: {
      name: '修改目录',
      enname: 'DomainControlmodifyFolder',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/modifyFolder',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          new: Joi.object().keys(model.model2Schema(model.common_domainmenu)),
          old: Joi.object().keys(model.model2Schema(model.common_domainmenu))
        })
      }
    },
    modifyFolder: {
      name: '删除选定项',
      enname: 'DomainControldeleteSelect',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/deleteSelect',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          domainmenu_id: Joi.number()
            .integer()
            .required()
        })
      }
    },
    addMenus: {
      name: '目录增加菜单',
      enname: 'DomainControladdMenus',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/addMenus',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          domain_id: Joi.number()
            .integer()
            .required(),
          parent_id: Joi.number()
            .integer()
            .required(),
          menus: Joi.array().items(
            Joi.object().keys({
              api_id: Joi.number().integer(),
              systemmenu_name: Joi.string().max(50),
              api_function: Joi.string().max(50)
            })
          )
        })
      }
    },
    changeOrder: {
      name: '修改菜单顺序',
      enname: 'DomainControlchangeOrder',
      tags: ['DomainControl'],
      path: '/api/common/system/DomainControl/changeOrder',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          menus: Joi.array().items(
            Joi.object().keys({
              domainmenu_id: Joi.number().integer()
            })
          )
        })
      }
    }
  }
}
