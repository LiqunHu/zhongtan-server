const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

// tables
const tb_common_systemmenu = model.common_systemmenu
const tb_common_api = model.common_api

exports.initAct = async () => {
  let returnData = {
    authInfo: GLBConfig.AUTHINFO,
    tfInfo: GLBConfig.TFINFO
  }

  logger.debug(returnData)
  
  return common.success(returnData)
}

exports.searchAct = async () => {
  let menus = [
    {
      systemmenu_id: 0,
      name: '根目录',
      isParent: true,
      title: '根目录',
      expand: true,
      node_type: GLBConfig.MTYPE_ROOT,
      children: []
    }
  ]
  menus[0].children = JSON.parse(JSON.stringify(await genMenu('0')))
  return common.success(menus)
}

const genMenu = async parentId => {
  let return_list = []
  let queryStr = `SELECT
                    a.*, b.api_path,
                    b.auth_flag,
                    b.show_flag
                  FROM
                    tbl_common_systemmenu a
                  LEFT JOIN tbl_common_api b ON a.api_id = b.api_id
                  WHERE a.parent_id = ?
                  ORDER BY
                    a.systemmenu_id, a.systemmenu_name`
  let menus = await model.simpleSelect(queryStr, [parentId])
  for (let m of menus) {
    let sub_menus = []
    if (m.node_type === GLBConfig.MTYPE_ROOT) {
      sub_menus = await genMenu(m.systemmenu_id)
      return_list.push({
        systemmenu_id: m.systemmenu_id,
        systemmenu_name: m.systemmenu_name,
        systemmenu_icon: m.systemmenu_icon,
        node_type: m.node_type,
        name: m.systemmenu_name,
        isParent: true,
        title: m.systemmenu_name,
        expand: true,
        parent_id: m.parent_id,
        children: sub_menus
      })
    } else {
      return_list.push({
        systemmenu_id: m.systemmenu_id,
        systemmenu_name: m.systemmenu_name,
        api_id: m.api_id,
        api_path: m.api_path,
        auth_flag: m.auth_flag,
        show_flag: m.show_flag,
        node_type: m.node_type,
        name: m.systemmenu_name + '->' + m.api_function,
        title: m.systemmenu_name + '->' + m.api_function,
        isParent: false,
        parent_id: m.parent_id
      })
    }
  }
  return return_list
}

exports.addFolderAct = async req => {
  let doc = common.docValidate(req)
  let folder = await tb_common_systemmenu.findOne({
    where: {
      systemmenu_name: doc.systemmenu_name
    }
  })

  if (folder) {
    return common.error('common_api_01')
  } else {
    await tb_common_systemmenu.create({
      systemmenu_name: doc.systemmenu_name,
      systemmenu_icon: doc.systemmenu_icon,
      node_type: '00', //NODETYPEINFO
      parent_id: doc.parent_id
    })

    return common.success()
  }
}

exports.modifyFolderAct = async req => {
  let doc = common.docValidate(req)

  let folder = await tb_common_systemmenu.findOne({
    where: {
      systemmenu_id: doc.systemmenu_id
    }
  })

  if (folder) {
    folder.systemmenu_name = doc.systemmenu_name
    folder.systemmenu_icon = doc.systemmenu_icon
    await folder.save()
  } else {
    return common.error('common_api_02')
  }

  return common.success()
}

const getApiName = path => {
  if (path) {
    let patha = path.split('/')
    let func = patha[patha.length - 1].toUpperCase()
    return func
  } else {
    return ''
  }
}

exports.addMenuAct = async req => {
  let doc = common.docValidate(req)

  let afolder = await tb_common_systemmenu.findOne({
    where: {
      systemmenu_name: doc.systemmenu_name
    }
  })

  let aapi = await tb_common_api.findOne({
    where: {
      api_name: doc.systemmenu_name
    }
  })

  let tapi = await tb_common_api.findOne({
    where: {
      api_function: getApiName(doc.api_path)
    }
  })
  if (afolder || aapi || tapi) {
    return common.error('common_api_01')
  } else {
    let api = await tb_common_api.create({
      api_name: doc.systemmenu_name,
      api_path: doc.api_path,
      api_function: getApiName(doc.api_path),
      auth_flag: doc.auth_flag,
      show_flag: doc.show_flag
    })

    await tb_common_systemmenu.create({
      systemmenu_name: doc.systemmenu_name,
      api_id: api.api_id,
      api_function: api.api_function,
      node_type: '01', //NODETYPEINFO
      parent_id: doc.parent_id
    })
  }

  return common.success()
}

exports.modifyMenuAct = async req => {
  let doc = common.docValidate(req)

  let menum = await tb_common_systemmenu.findOne({
    where: {
      systemmenu_id: doc.systemmenu_id
    }
  })

  if (menum) {
    let api = await tb_common_api.findOne({
      where: {
        api_id: menum.api_id
      }
    })

    if (api.api_name != doc.systemmenu_name) {
      let afolder = await tb_common_systemmenu.findOne({
        where: {
          systemmenu_name: doc.systemmenu_name
        }
      })

      let aapi = await tb_common_api.findOne({
        where: {
          api_name: doc.systemmenu_name
        }
      })
      if (afolder || aapi) {
        return common.error('common_api_01')
      }
    }

    if (api.api_function != getApiName(doc.api_path)) {
      let tapi = await tb_common_api.findOne({
        where: {
          api_function: getApiName(doc.api_path)
        }
      })
      if (tapi) {
        common.error('common_api_01')
      }
    }

    if (api) {
      api.api_name = doc.systemmenu_name
      api.api_path = doc.api_path
      api.api_function = getApiName(doc.api_path)
      api.auth_flag = doc.auth_flag
      api.show_flag = doc.show_flag
      await api.save()
      menum.systemmenu_name = doc.systemmenu_name
      menum.api_function = api.api_function
      await menum.save()
    } else {
      return common.error('common_api_02')
    }
  } else {
    return common.error('common_api_02')
  }

  return common.success()
}
