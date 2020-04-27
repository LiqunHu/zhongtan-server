const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_invoice_fixed_fee_config', {
  fixed_fee_config_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  fee_cargo_type: {
    // fee_cargo_type
    type: db.STRING(5),
    allowNull: false
  },
  fee_id: {
    // fee_id
    type: db.STRING(50),
    allowNull: false
  },
  fee_name: {
    // fee_name
    type: db.STRING(50),
    allowNull: false
  },
  fee_column: {
    // fee_column
    type: db.STRING(100),
    allowNull: false
  },
  fee_type: {
    // fee_type
    type: db.STRING(50),
    allowNull: false
  }
})
