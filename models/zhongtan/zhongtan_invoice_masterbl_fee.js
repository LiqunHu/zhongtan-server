const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_masterbl_fee', {
  invoice_masterbl_fee_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_masterbi_id: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_do_fee: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_of: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_bl_amendment: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_cod_charge: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_transfer: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_lolf: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_lcl: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_amendment: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_tasac: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_printing: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_others: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_invoice_version: {
    type: db.STRING(5),
    allowNull: false,
    defaultValue: 'V1'
  },
  invoice_masterbi_invoice_id: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_receipt_id: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_fee_total: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_fee_currency: {
    type: db.STRING(10),
    allowNull: true
  },
  invoice_masterbi_fee_rate: {
    type: db.STRING(10),
    allowNull: true
  }
})
