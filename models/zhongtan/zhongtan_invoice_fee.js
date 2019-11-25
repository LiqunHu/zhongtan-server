const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_invoice_fee', {
  invoice_fee_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_masterbi_id: {
    type: db.IDNO,
    allowNull: false
  },
  invoice_fee_type: {
    // Type
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_fee_amount: {
    // Fee amount
    type: db.INTEGER,
    defaultValue: '',
    allowNull: false
  }
})
