const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_invoice_default_fee', {
  default_fee_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  fee_cargo_type: {
    // fee_cargo_type
    type: db.STRING(5),
    allowNull: false
  },
  fee_name: {
    // fee name
    type: db.STRING(50),
    allowNull: false
  },
  fee_type: {
    // fee_type
    type: db.STRING(5),
    allowNull: false
  },
  fee_container_size: {
    // fee_container_size
    type: db.STRING(10),
    allowNull: true
  },
  fee_amount: {
    // fee_amount
    type: db.STRING(50),
    allowNull: false
  },
  fee_currency: {
    // fee_currency
    type: db.STRING(5),
    allowNull: false
  },
  user_id: {
    // user_id
    type: db.STRING(36),
    allowNull: true
  }
})
