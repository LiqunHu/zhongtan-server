const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_masterbl_edit_record', {
  masterbl_edit_record_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_masterbi_id: {
    // 堆场名称
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_bl: {
    // 堆场代码
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_deposit: {
    // 堆场邮箱
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_do_fee: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_of: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_bl_amendment: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_cod_charge: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_transfer: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_lolf: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_lcl: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_amendment: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_tasac: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_printing: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  invoice_masterbi_others: {
    // 堆场电话
    type: db.STRING(20),
    allowNull: true
  },
  edit_record_operator: {
    // 堆场电话
    type: db.STRING(50),
    allowNull: true
  }
})
