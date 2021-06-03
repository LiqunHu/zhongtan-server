const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_payment_items', {
  payment_items_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_items_code: {
    // 费用代码
    type: db.STRING(20),
    allowNull: false
  },
  payment_items_name: {
    // 费用名称
    type: db.STRING(100),
    allowNull: false
  }
})
