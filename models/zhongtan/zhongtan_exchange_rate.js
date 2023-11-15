const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_exchange_rate', {
  rate_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  rate_usd: {
    // 启用日期
    type: db.STRING(20),
    allowNull: false
  },
  rate_tzs: {
    // 启用日期
    type: db.STRING(20),
    allowNull: false
  },
  enable_date: {
    // 启用日期
    type: db.STRING(20),
    allowNull: false
  }
})
