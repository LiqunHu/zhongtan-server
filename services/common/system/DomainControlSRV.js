const Joi = require('joi')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const Sequence = require('../../../util/Sequence')
const logger = require('../../../util/Logger').createLogger('GroupControlSRV')
const model = require('../../../model')

const tb_common_domain = model.common_domain
const tb_common_domaintemplate = model.common_domaintemplate
const tb_usergroup = model.common_usergroup
const tb_user = model.common_user
const tb_common_templatemenu = model.common_templatemenu
const tb_common_domainmenu = model.common_domainmenu
const tb_common_systemmenu = model.common_systemmenu

exports.DomainControlResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'add') {
    addAct(req, res)
  } else if (method === 'modify') {
    modifyAct(req, res)
  } else if (method === 'searchDomainMenu') {
    searchDomainMenuAct(req, res)
  } else if (method === 'addFolder') {
    addFolderAct(req, res)
  } else if (method === 'modifyFolder') {
    modifyFolderAct(req, res)
  } else if (method === 'deleteSelect') {
    deleteSelectAct(req, res)
  } else if (method === 'addMenus') {
    addMenusAct(req, res)
  } else if (method === 'changeOrder') {
    changeOrderAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=init 获取机构数据字典
 * @apiName DomainControl init
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 获取机构数据字典
 *
 * @apiHeader {String} Authorization                 Authorization token.
 */
async function initAct(req, res) {
  try {
    let doc = common.docValidate(req),
      user = req.user,
      returnData = {
        tfInfo: GLBConfig.TFINFO
      }

    let templates = await tb_common_domaintemplate.findAll()
    returnData.templateInfo = []
    for (let t of templates) {
      returnData.templateInfo.push({
        id: t.domaintemplate_id,
        text: t.domaintemplate_name
      })
    }
    returnData.sysmenus = [
      {
        systemmenu_id: 0,
        name: '根目录',
        isParent: true,
        node_type: GLBConfig.MTYPE_ROOT,
        children: []
      }
    ]
    returnData.sysmenus[0].children = JSON.parse(JSON.stringify(await genMenu('0')))

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function genMenu(parentId) {
  let return_list = []
  let menus = await tb_common_systemmenu.findAll({
    where: {
      parent_id: parentId
    },
    order: [['created_at', 'DESC']]
  })
  for (let m of menus) {
    let sub_menus = []
    if (m.node_type === GLBConfig.MTYPE_ROOT) {
      sub_menus = await genMenu(m.systemmenu_id)
      return_list.push({
        systemmenu_id: m.systemmenu_id,
        systemmenu_name: m.systemmenu_name,
        systemmenu_icon: m.systemmenu_icon,
        node_type: m.node_type,
        systemmenu_type: m.systemmenu_type,
        name: m.systemmenu_name,
        isParent: true,
        parent_id: m.parent_id,
        children: sub_menus
      })
    } else {
      return_list.push({
        systemmenu_id: m.systemmenu_id,
        systemmenu_name: m.systemmenu_name,
        api_id: m.api_id,
        api_function: m.api_function,
        node_type: m.node_type,
        systemmenu_type: m.systemmenu_type,
        name: m.systemmenu_name + '->' + m.api_function,
        isParent: false,
        parent_id: m.parent_id
      })
    }
  }
  return return_list
}

/**
 * @api {post} /api/common/system/DomainControl?method=search 机构查询
 * @apiName Domain search
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 机构查询
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {String} search_text                   Type, optional 查询条件.
 * @apiParam {String} order                         Type, optional 排序.
 * @apiParam {Number} limit                         Type, optional 数量限制.
 * @apiParam {Number} offset                        Type, optional 偏移量.
 */
// const searchSchema = {
//   search_text: Joi.string().empty('').max(50),
//   order: Joi.string().empty('').max(50),
//   limit: Joi.number().integer(),
//   offset: Joi.number().integer()
// }
async function searchAct(req, res) {
  try {
    let doc = common.docValidate(req),
      user = req.user,
      returnData = {}

    let queryStr = `select * from tbl_common_domain where state = '1' `
    let replacements = []

    if (doc.search_text) {
      queryStr += ' and (domain like ? or domain_name like ? or domain_address like ?)'
      let search_text = '%' + doc.search_text + '%'
      replacements.push(search_text)
      replacements.push(search_text)
      replacements.push(search_text)
    }

    let result = await model.queryWithCount(doc, queryStr, replacements)

    returnData.total = result.count
    returnData.rows = result.data

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=add 机构增加
 * @apiName Domain add
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 机构增加
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {String} domain                        Type, parameter and Domain编号.
 * @apiParam {Number} domaintemplate_id             Type, parameter and Domain模板id.
 * @apiParam {String} domain_name                   Type, parameter and Domain名称.
 * @apiParam {String} domain_province               Type, parameter and 省.
 * @apiParam {String} domain_city                   Type, parameter and 市.
 * @apiParam {String} domain_district               Type, parameter and 区.
 * @apiParam {String} domain_address                Type, parameter and 地址.
 * @apiParam {String} domain_contact                Type, parameter and 联系人.
 * @apiParam {String} domain_phone                  Type, parameter and 联系电话.
 * @apiParam {String} domain_description            Type, parameter and domain描述.
 */
async function addAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user
    let domain = await tb_common_domain.findOne({
      where: {
        $or: [
          {
            domain: doc.domain
          },
          {
            domain_name: doc.domain_name
          }
        ]
      }
    })
    if (domain) {
      common.sendError(res, 'domain_01')
      return
    } else {
      domain = await tb_common_domain.create({
        domain: doc.domain,
        domaintemplate_id: doc.domaintemplate_id,
        domain_name: doc.domain_name,
        domain_province: doc.domain_province,
        domain_city: doc.domain_city,
        domain_district: doc.domain_district,
        domain_address: doc.domain_address,
        domain_contact: doc.domain_contact,
        domain_phone: doc.domain_phone,
        domain_description: doc.domain_description
      })

      let usergroup = await tb_usergroup.create({
        domain_id: domain.domain_id,
        usergroup_name: 'administrator',
        usergroup_type: GLBConfig.TYPE_ADMINISTRATOR,
        node_type: GLBConfig.MTYPE_ROOT,
        parent_id: 0
      })

      let adduser = await tb_user.create({
        user_id: await Sequence.genUserID(),
        domain_id: domain.domain_id,
        usergroup_id: usergroup.usergroup_id,
        user_username: doc.domain + 'admin',
        user_name: 'admin',
        user_password: 'admin',
        user_type: GLBConfig.TYPE_ADMINISTRATOR
      })

      async function genDomainMenu(domaintemplate_id, parentId, cparentId) {
        let menus = await tb_common_templatemenu.findAll({
          where: {
            domaintemplate_id: domaintemplate_id,
            parent_id: parentId
          }
        })
        for (let m of menus) {
          let sub_menus = []
          if (m.node_type === GLBConfig.MTYPE_ROOT) {
            let dm = await tb_common_domainmenu.create({
              domain_id: domain.domain_id,
              domainmenu_name: m.templatemenu_name,
              domainmenu_icon: m.templatemenu_icon,
              domainmenu_index: m.templatemenu_index,
              api_id: m.api_id,
              api_function: m.api_function,
              node_type: m.node_type,
              root_show_flag: m.root_show_flag,
              parent_id: cparentId
            })
            sub_menus = await genDomainMenu(domaintemplate_id, m.templatemenu_id, dm.domainmenu_id)
          } else {
            let dm = await tb_common_domainmenu.create({
              domain_id: domain.domain_id,
              domainmenu_name: m.templatemenu_name,
              domainmenu_icon: m.templatemenu_icon,
              domainmenu_index: m.templatemenu_index,
              api_id: m.api_id,
              api_function: m.api_function,
              node_type: m.node_type,
              parent_id: cparentId
            })
          }
        }
      }

      await genDomainMenu(doc.domaintemplate_id, '0', '0')

      return common.sendData(res, domain)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=modify 机构修改
 * @apiName Domain modify
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 机构修改
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Object} new                           Type, parameter and 修改后数据.
 * @apiParam {Object} old                           Type, parameter and 修改前记录.
 */
// const modifySchema = {
//   new: Joi.object().keys(common.model2Schema(tb_common_domain)),
//   old: Joi.object().keys(common.model2Schema(tb_common_domain))
// }
async function modifyAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user
    let domain = await tb_common_domain.findOne({
      where: {
        domain_id: doc.old.domain_id
      }
    })
    if (domain) {
      domain.domain_name = doc.new.domain_name
      domain.domain_address = doc.new.domain_address
      domain.domain_contact = doc.new.domain_contact
      domain.domain_phone = doc.new.domain_phone
      domain.domain_description = doc.new.domain_description
      await domain.save()
      return common.sendData(res, domain)
    } else {
      return common.sendError(res, 'group_02')
    }
  } catch (error) {
    common.sendFault(res, error)
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=searchDomainMenu 查询机构菜单
 * @apiName Domain searchDomainMenu
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 查询机构菜单
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Number} domain_id                     查询domain id.
 */
async function searchDomainMenuAct(req, res) {
  try {
    let doc = common.docValidate(req),
      user = req.user

    let menus = [
      {
        domainmenu_id: 0,
        name: '根目录',
        isParent: true,
        node_type: GLBConfig.MTYPE_ROOT,
        children: []
      }
    ]
    menus[0].children = JSON.parse(JSON.stringify(await genDomainMenu(doc.domain_id, '0')))

    common.sendData(res, menus)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function genDomainMenu(domain_id, parentId) {
  let return_list = []
  let menus = await tb_common_domainmenu.findAll({
    where: {
      domain_id: domain_id,
      parent_id: parentId
    },
    order: [['domainmenu_index']]
  })
  for (let m of menus) {
    let sub_menus = []
    if (m.node_type === GLBConfig.MTYPE_ROOT) {
      sub_menus = await genDomainMenu(domain_id, m.domainmenu_id)
      return_list.push({
        domainmenu_id: m.domainmenu_id,
        domainmenu_name: m.domainmenu_name,
        domainmenu_icon: m.domainmenu_icon,
        node_type: m.node_type,
        name: m.domainmenu_name,
        isParent: true,
        parent_id: m.parent_id,
        root_show_flag: m.root_show_flag,
        children: sub_menus
      })
    } else {
      return_list.push({
        domainmenu_id: m.domainmenu_id,
        domainmenu_name: m.domainmenu_name,
        api_id: m.api_id,
        node_type: m.node_type,
        name: m.domainmenu_name,
        isParent: false,
        parent_id: m.parent_id
      })
    }
  }
  return return_list
}

/**
 * @api {post} /api/common/system/DomainControl?method=addFolder 增加目录
 * @apiName Domain addFolder
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription Domain 增加目录
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Number} parent_id                     上级id.
 * @apiParam {Number} domain_id                     机构id.
 * @apiParam {String} domainmenu_name               目录名称.
 * @apiParam {String} domainmenu_icon               目录图标.
 * @apiParam {String} root_show_flag                是否显示表示.
 */
async function addFolderAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let nextIndex = await tb_common_domainmenu.max('domainmenu_index', {
      where: {
        parent_id: doc.parent_id
      }
    })
    if (!nextIndex) {
      nextIndex = 0
    } else {
      nextIndex += 1
    }

    let folder = await tb_common_domainmenu.create({
      domain_id: doc.domain_id,
      domainmenu_name: doc.domainmenu_name,
      domainmenu_icon: doc.domainmenu_icon,
      node_type: '00', //NODETYPEINFO
      parent_id: doc.parent_id,
      root_show_flag: doc.root_show_flag,
      domainmenu_index: nextIndex
    })

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=modifyFolder 修改目录
 * @apiName Domain modifyFolder
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription Domain 目录修改
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Object} new                           Type, parameter and 修改后数据.
 * @apiParam {Object} old                           Type, parameter and 修改前记录.
 */
async function modifyFolderAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let folder = await tb_common_domainmenu.findOne({
      where: {
        domainmenu_id: doc.domainmenu_id
      }
    })

    if (folder) {
      folder.domainmenu_name = doc.domainmenu_name
      folder.domainmenu_icon = doc.domainmenu_icon
      folder.root_show_flag = doc.root_show_flag
      await folder.save()
    } else {
      return common.sendError(res, 'common_api_02')
    }

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=deleteSelect 删除选定项
 * @apiName Domain deleteSelect
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription Domain 删除选定项
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Number} domainmenu_id                 删除对象id.
 */
async function deleteSelectAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let tm = await tb_common_domainmenu.findOne({
      where: {
        domainmenu_id: doc.domainmenu_id
      }
    })
    if (tm) {
      if (doc.node_type === '00') {
        await folderDelete(tm.domainmenu_id)
      }
      await tm.destroy()
    }

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function folderDelete(domainmenu_id) {
  let subM = await tb_common_domainmenu.findAll({
    where: {
      parent_id: domainmenu_id
    },
    order: [['node_type']]
  })

  for (let sm of subM) {
    if ((sm.node_type = '00')) {
      await folderDelete(sm.domainmenu_id)
    }
    await sm.destroy()
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=addMenus 目录增加菜单
 * @apiName Domain addMenus
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 向选定目录增加菜单
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Number} domain_id                     机构id.
 * @apiParam {Number} parent_id                     目标目录id.
 * @apiParam {Object[]} menus                       增加的菜单.
 */
async function addMenusAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let existM = await tb_common_domainmenu.findAll({
      where: {
        domain_id: doc.domain_id,
        parent_id: doc.parent_id
      }
    })

    let addMenus = []
    for (let m of doc.menus) {
      let addFlag = true
      for (let em of existM) {
        if (m.api_id === em.api_id) {
          addFlag = false
          break
        }
      }
      if (addFlag) {
        addMenus.push(m)
      }
    }

    let nextIndex = await tb_common_domainmenu.max('domainmenu_index', {
      where: {
        parent_id: doc.parent_id
      }
    })

    if (!nextIndex) {
      nextIndex = 0
    }

    for (let am of addMenus) {
      nextIndex += 1
      await tb_common_domainmenu.create({
        domain_id: doc.domain_id,
        domainmenu_name: am.systemmenu_name,
        api_id: am.api_id,
        api_function: am.api_function,
        node_type: '01', //NODETYPEINFO
        parent_id: doc.parent_id,
        domainmenu_index: nextIndex
      })
    }

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}

/**
 * @api {post} /api/common/system/DomainControl?method=changeOrder 修改菜单顺序
 * @apiName Domain changeOrder
 * @apiGroup DomainControl
 * @apiVersion 1.0.0
 * @apiDescription 修改菜单顺序
 *
 * @apiHeader {String} Authorization                Authorization token.
 *
 * @apiParam {Object[]} menus                       新排序的菜单.
 */
async function changeOrderAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    for (let i = 0; i < doc.menus.length; i++) {
      let dmenu = await tb_common_domainmenu.findOne({
        where: {
          domainmenu_id: doc.menus[i].domainmenu_id
        }
      })
      dmenu.domainmenu_index = i
      await dmenu.save()
    }

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}
