const moment = require('moment')
const db = require('../app/db')
const logger = require('../app/logger').createLogger(__filename)
const sequelize = db.sequelize

let genUserID = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('userIDSeq') num", {
      type: sequelize.QueryTypes.SELECT
    })
    let currentIndex = ('000000000000000' + queryRst[0].num).slice(-15)

    let today = moment().format('[UI]YYYYMMDD')

    return today + currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genReceiptNo = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('receiptSeq') num", {
      type: sequelize.QueryTypes.SELECT
    })
    let currentIndex = ('00000000000' + queryRst[0].num).slice(-4)

    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genInvoiceReceiptNo = async carrier => {
  try {
    let queryRst
    if (carrier === 'COSCO') {
      queryRst = await sequelize.query("select nextval('invoiceCOSCOReceiptSeq') num", {
        type: sequelize.QueryTypes.SELECT
      })
    } else if (carrier === 'OOCL') {
      queryRst = await sequelize.query("select nextval('invoiceOOCLReceiptSeq') num", {
        type: sequelize.QueryTypes.SELECT
      })
    }
    let currentIndex = carrier + moment().format('YYYYMMDD') + ('00000000000' + queryRst[0].num).slice(-4)

    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genEdiInterchangeID = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('ediInterchangeIDSeq') num", {
      type: sequelize.QueryTypes.SELECT
    }) 
    let currentIndex = moment().format('YYYYMMDDHHmm') + ('0000' + queryRst[0].num).slice(-4)
    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genEdiMessageIDSeq = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('ediMessageIDSeq') num", {
      type: sequelize.QueryTypes.SELECT
    }) 
    let currentIndex = moment().format('YYYYMMDD') + ('000000' + queryRst[0].num).slice(-6)
    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genFixedInvoiceSeq = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('fixedInvoiceSeq') num", {
      type: sequelize.QueryTypes.SELECT
    }) 
    let currentIndex = moment().format('MMDD') + ('0000' + queryRst[0].num).slice(-4)
    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genFixedReceiptSeq = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('fixedReceiptSeq') num", {
      type: sequelize.QueryTypes.SELECT
    }) 
    let currentIndex = moment().format('MMDD') + ('0000' + queryRst[0].num).slice(-4)
    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genEquipmentInvoiceSeq = async () => {
  try {
    let queryRst = await sequelize.query("select nextval('equipmentInvoiceSeq') num", {
      type: sequelize.QueryTypes.SELECT
    }) 
    let currentIndex = moment().format('YYYY') + '-' + ('000000' + queryRst[0].num).slice(-6)
    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

let genEquipmentReceiptSeq = async (charge_carrier) => {
  try {
    let seq_name = charge_carrier + 'EquipmentReceiptSeq'
    let queryRst = await sequelize.query("select nextval('" + seq_name + "') num", {
      type: sequelize.QueryTypes.SELECT
    }) 
    let currentIndex = charge_carrier + moment().format('YYYYMMDD') + '-' + ('000000' + queryRst[0].num).slice(-6)
    return currentIndex
  } catch (error) {
    logger.error(error)
    return error
  }
}

module.exports = {
  genUserID: genUserID,
  genReceiptNo: genReceiptNo,
  genInvoiceReceiptNo: genInvoiceReceiptNo,
  genEdiInterchangeID: genEdiInterchangeID,
  genEdiMessageIDSeq: genEdiMessageIDSeq,
  genFixedInvoiceSeq: genFixedInvoiceSeq,
  genFixedReceiptSeq: genFixedReceiptSeq,
  genEquipmentInvoiceSeq: genEquipmentInvoiceSeq,
  genEquipmentReceiptSeq: genEquipmentReceiptSeq
}
