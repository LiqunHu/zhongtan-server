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

module.exports = {
  genUserID: genUserID,
  genReceiptNo: genReceiptNo
}
