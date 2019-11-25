const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_customer', {
  invoice_customer_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_customer_name: {
    // Customer
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  }
})
