const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')

const tb_portinfo = model.zhongtan_portinfo

exports.PortConfigResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'add') {
    addAct(req, res)
  } else if (method === 'modify') {
    modifyAct(req, res)
  } else if (method === 'delete') {
    deleteAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function initAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let returnData = {
      PortCountryINFO: GLBConfig.PortCountryINFO
    }
    common.sendData(res, returnData)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function searchAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user
    let returnData = {}

    let queryStr = `select * from tbl_zhongtan_portinfo where state = '1'`
    let replacements = []

    if (doc.search_text) {
      queryStr +=
        ' and (portinfo_name like ? or portinfo_name_cn like ? or portinfo_code like ?)'
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
    return common.sendFault(res, error)
  }
}

async function addAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let portinfo = await tb_portinfo.create({
      portinfo_country: doc.portinfo_country,
      portinfo_name: doc.portinfo_name,
      portinfo_name_cn: doc.portinfo_name_cn,
      portinfo_code: doc.portinfo_code
    })

    common.sendData(res, portinfo)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function modifyAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let portinfo = await tb_portinfo.findOne({
      where: {
        portinfo_id: doc.old.portinfo_id,
        state: GLBConfig.ENABLE
      }
    })
    if (portinfo) {
      portinfo.portinfo_country = doc.new.portinfo_country
      portinfo.portinfo_name = doc.new.portinfo_name
      portinfo.portinfo_name_cn = doc.new.portinfo_name_cn
      portinfo.portinfo_code = doc.new.portinfo_code

      await portinfo.save()

      return common.sendData(res, portinfo)
    } else {
      return common.sendError(res, 'operator_03')
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function deleteAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let portinfo = await tb_portinfo.findOne({
      where: {
        portinfo_id: doc.portinfo_id,
        state: GLBConfig.ENABLE
      }
    })
    if (portinfo) {
      portinfo.state = GLBConfig.DISABLE
      await portinfo.save()

      return common.sendData(res)
    } else {
      return common.sendError(res, 'operator_03')
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}
