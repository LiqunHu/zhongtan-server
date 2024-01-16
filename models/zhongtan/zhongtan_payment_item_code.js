const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_payment_item_code', {
  item_code_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_item_code: {
    type: db.STRING(20),
    allowNull: false
  },
  item_code_payable_debit: {
    type: db.STRING(20),
    allowNull: false
  },
  item_code_payable_credit: {
    type: db.STRING(20),
    allowNull: false
  },
  item_code_payment_debit: {
    type: db.STRING(20),
    allowNull: true
  },
  item_code_payment_credit: {
    type: db.STRING(20),
    allowNull: true
  }
})
