const _ = require('lodash')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
const Op = model.Op

const tb_billladingno_batch = model.zhongtan_billladingno_batch
const tb_billladingno_pool = model.zhongtan_billladingno_pool

exports.initAct = async () => {
  let returnData = {
    VesselServiceINFO: _.drop(GLBConfig.VesselServiceINFO),
    STATUSINFO: GLBConfig.STATUSINFO
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_billladingno_batch where '1' = '1' and state = '1'`
  let replacements = []

  if (doc.search_text) {
    queryStr += ' and (billladingno_batch_fix_string like ?)'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let fixStr = doc.billladingno_batch_fix_string
  let fixStrEnd = doc.billladingno_batch_fix_string_end || ''
  let numLen = parseInt(doc.billladingno_batch_number_length) * -1
  let numStart = parseInt(doc.billladingno_batch_number_start)
  let blCount = parseInt(doc.billladingno_batch_count)
  let blStart = fixStr + ('0000000000000000000000000000000' + numStart).slice(numLen) + fixStrEnd
  let blEnd = fixStr + ('0000000000000000000000000000000' + (numStart + blCount)).slice(numLen) + fixStrEnd

  let blcount = await tb_billladingno_pool.count({
    where: {
      billladingno_pool_no: {
        [Op.lte]: blEnd,
        [Op.gte]: blStart
      }
    }
  })

  if (blcount > 0) {
    return common.error('blconfig_01')
  }

  let blBatch = await tb_billladingno_batch.create({
    billladingno_batch_vessel_service: doc.billladingno_batch_vessel_service,
    billladingno_batch_fix_string: doc.billladingno_batch_fix_string,
    billladingno_batch_fix_string_end: doc.billladingno_batch_fix_string_end || '',
    billladingno_batch_number_length: doc.billladingno_batch_number_length,
    billladingno_batch_number_start: doc.billladingno_batch_number_start,
    billladingno_batch_count: doc.billladingno_batch_count
  })
  let currNum = numStart
  for (let i = 0; i < blCount; i++) {
    await tb_billladingno_pool.create({
      billladingno_pool_no: fixStr + ('0000000000000000000000000000000' + currNum).slice(numLen) + fixStrEnd,
      billladingno_batch_id: blBatch.billladingno_batch_id,
      billladingno_pool_vessel_service: blBatch.billladingno_batch_vessel_service,
      billladingno_pool_state: '0'
    })
    currNum += 1
  }

  logger.debug('add success')
  return common.success(doc)
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)
  let blBatch = await tb_billladingno_batch.findOne({
    where: {
      billladingno_batch_id: doc.billladingno_batch_id,
      billladingno_batch_use_count: 0,
      state: GLBConfig.ENABLE
    }
  })

  if (blBatch) {
    blBatch.state = GLBConfig.DISABLE
    await blBatch.save()
    await tb_billladingno_pool.update(
      {
        billladingno_pool_state: '2'
      },
      {
        where: {
          billladingno_batch_id: blBatch.billladingno_batch_id,
          billladingno_pool_state: '0'
        }
      }
    )
    return common.success()
  } else {
    return common.error('blconfig_02')
  }
}
