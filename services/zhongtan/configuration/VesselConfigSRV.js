const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')
const Op = model.Op

const tb_vessel = model.zhongtan_vessel

exports.VessleConfigResource = (req, res) => {
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
      VesselServiceINFO: GLBConfig.VesselServiceINFO
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

    let queryStr = `select * from tbl_zhongtan_vessel where state = '1'`
    let replacements = []

    if (doc.search_text) {
      queryStr += ' and (vessel_name like ? or vessel_operator like ? or vessel_code like ?)'
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

    let vessel = await tb_vessel.findOne({
      where: {
        [Op.or]: [{ vessel_name: doc.vessel_name }, { vessel_code: doc.vessel_code }]
      }
    })

    if (vessel) {
      return common.sendError(res, 'common_02')
    } else {
      vessel = await tb_vessel.create({
        vessel_service_name: doc.vessel_service_name,
        vessel_name: doc.vessel_name,
        vessel_operator: doc.vessel_operator,
        vessel_code: doc.vessel_code
      })

      common.sendData(res, vessel)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function modifyAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let vessel = await tb_vessel.findOne({
      where: {
        vessel_id: doc.old.vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    if (vessel) {
      vessel.vessel_service_name = doc.new.vessel_service_name
      vessel.vessel_name = doc.new.vessel_name
      vessel.vessel_operator = doc.new.vessel_operator
      vessel.vessel_code = doc.new.vessel_code

      await vessel.save()

      return common.sendData(res, vessel)
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

    let vessel = await tb_vessel.findOne({
      where: {
        portinfo_id: doc.portinfo_id,
        state: GLBConfig.ENABLE
      }
    })
    if (portinfo) {
      vessel.state = GLBConfig.DISABLE
      await vessel.save()

      return common.sendData(res)
    } else {
      return common.sendError(res, 'operator_03')
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}
