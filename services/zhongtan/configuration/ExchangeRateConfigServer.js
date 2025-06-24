const common = require('../../../util/CommonUtil')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_rate = model.zhongtan_exchange_rate

exports.initAct = async () => {
  let returnData = {}
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_exchange_rate where state = 1 order by STR_TO_DATE(enable_date, '%d/%m/%Y') desc`
  let replacements = []
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let rate = await tb_rate.create({
    rate_usd: doc.rate_usd,
    rate_tzs: doc.rate_tzs,
    enable_date: doc.enable_date,
  })

  return common.success(rate)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let rate = await tb_rate.findOne({
    where: {
      rate_id: doc.old.rate_id
    }
  })
  if (rate) {
    rate.rate_usd = doc.new.rate_usd
    rate.rate_tzs = doc.new.rate_tzs
    rate.enable_date = doc.new.enable_date
    await rate.save()
    return common.success(rate)
  } else {
    return common.error('operator_03')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let rate = await tb_rate.findOne({
    where: {
      rate_id: doc.rate_id,
      state: GLBConfig.ENABLE
    }
  })
  if (rate) {
    rate.state = GLBConfig.DISABLE
    await rate.save()

    return common.success()
  } else {
    return common.error('operator_03')
  }
}


exports.getCurrentExchangeRateTZS = async usdAmount => {
  let queryStr = `select * from tbl_zhongtan_exchange_rate where state = 1 and STR_TO_DATE(enable_date, '%d/%m/%Y') <= STR_TO_DATE(DATE_FORMAT(NOW(), '%d/%m/%Y'), '%d/%m/%Y') order by STR_TO_DATE(enable_date, '%d/%m/%Y') desc, rate_id desc limit 1`
  let replacements = []
  let rate_rows = await model.simpleSelect(queryStr, replacements)
  usdAmount = usdAmount.replace(/,/g, '')
  if(rate_rows && rate_rows.length > 0) {
    let rate_item = rate_rows[0]
    let rate_amount = usdAmount
    if(rate_item.rate_tzs) {
      rate_amount = new Decimal(usdAmount).times(new Decimal(rate_item.rate_tzs))
    }
    return {source: Decimal.isDecimal(usdAmount) ? usdAmount.toNumber() : usdAmount, amount: Decimal.isDecimal(rate_amount) ? rate_amount.toNumber() : rate_amount, rate: new Decimal(rate_item.rate_tzs).toNumber()}
  } else {
    return {source: Decimal.isDecimal(usdAmount) ? usdAmount.toNumber() : usdAmount, amount: Decimal.isDecimal(usdAmount) ? usdAmount.toNumber() : usdAmount, rate: 1}
  }
}

exports.getCurrentExchangeRateUSD = async tzsAmount => {
  let queryStr = `select * from tbl_zhongtan_exchange_rate where state = 1 and STR_TO_DATE(enable_date, '%d/%m/%Y') <= STR_TO_DATE(DATE_FORMAT(NOW(), '%d/%m/%Y'), '%d/%m/%Y') order by STR_TO_DATE(enable_date, '%d/%m/%Y') desc, rate_id desc limit 1`
  let replacements = []
  let rate_rows = await model.simpleSelect(queryStr, replacements)
  tzsAmount = tzsAmount.replace(/,/g, '')
  if(rate_rows && rate_rows.length > 0) {
    let rate_item = rate_rows[0]
    let rate_amount = tzsAmount
    if(rate_item.rate_tzs) {
      rate_amount = new Decimal(tzsAmount).div(new Decimal(rate_item.rate_usd))
    }
    return {source: Decimal.isDecimal(tzsAmount) ? tzsAmount.toNumber() : tzsAmount, amount: Decimal.isDecimal(rate_amount) ? rate_amount.toNumber() : rate_amount, rate: new Decimal(rate_item.rate_usd).toNumber()}
  } else {
    return {source: Decimal.isDecimal(tzsAmount) ? tzsAmount.toNumber() : tzsAmount, amount: Decimal.isDecimal(tzsAmount) ? tzsAmount.toNumber() : tzsAmount, rate: 1}
  }
}
