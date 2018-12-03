const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')

const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage

exports.VoyageConfigResource = (req, res) => {
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
    let returnData = {
      VesselINFO: []
    }

    let Vessels = await tb_vessel.findAll({
      where: {
        state: GLBConfig.ENABLE
      }
    })

    for (let v of Vessels) {
      returnData.VesselINFO.push({
        id: v.vessel_id,
        text: v.vessel_name
      })
    }

    common.sendData(res, returnData)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function searchAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let returnData = {}

    let queryStr = `select * from tbl_zhongtan_voyage where state = '1'`
    let replacements = []

    if (doc.search_text) {
      queryStr += ' and voyage_number like ?'
      let search_text = '%' + doc.search_text + '%'
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

    let voyage = await tb_voyage.findOne({
      where: {
        voyage_number: doc.voyage_number
      }
    })

    if (voyage) {
      return common.sendError(res, 'common_02')
    } else {
      let voyage = await tb_voyage.create({
        vessel_id: doc.vessel_id,
        voyage_number: doc.voyage_number,
        voyage_eta_date: doc.voyage_eta_date
      })

      common.sendData(res, voyage)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function modifyAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let voyage = await tb_voyage.findOne({
      where: {
        voyage_id: doc.old.voyage_id,
        state: GLBConfig.ENABLE
      }
    })
    if (voyage) {
      voyage.vessel_id = doc.new.vessel_id
      voyage.voyage_number = doc.new.voyage_number
      voyage.voyage_eta_date = doc.new.voyage_eta_date

      await voyage.save()

      return common.sendData(res, voyage)
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

    let voyage = await tb_voyage.findOne({
      where: {
        voyage_id: doc.voyage_id,
        state: GLBConfig.ENABLE
      }
    })
    if (voyage) {
      voyage.state = GLBConfig.DISABLE
      await voyage.save()

      return common.sendData(res)
    } else {
      return common.sendError(res, 'operator_03')
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}
