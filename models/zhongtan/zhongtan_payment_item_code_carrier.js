const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_payment_item_code_carrier', {
  item_code_carrier_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_item_code: {
    type: db.STRING(20),
    allowNull: false
  },
  item_code_id: {
    type: db.STRING(20),
    allowNull: false
  },
  item_code_carrier: {
    type: db.STRING(50),
    allowNull: true
  }
})
