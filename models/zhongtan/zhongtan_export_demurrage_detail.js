const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_demurrage_detail', {
  demurrage_detail_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  demurrage_invoice_uploadfile_id: {
    // 发票ID
    type: db.STRING(20),
    allowNull: false
  },
  demurrage_invoice_no: {
    // 发票编号
    type: db.STRING(20),
    allowNull: false
  },
  demurrage_invoice_amount: {
    // 发票金额
    type: db.STRING(20),
    allowNull: false
  },
  demurrage_invoice_masterbi_id: {
    // 提单ID
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_masterbi_bl: {
    // 提单号
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_containers_id: {
    // 箱ID
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_containers_no: {
    // 箱号
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_party: {
    // 发票抬头
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_free_days: {
    // 免箱期
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_starting_date: {
    // 开始日期
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_loading_date: {
    // 装船日期
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_demurrage_days: {
    // 滞期天数
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_demurrage_amount: {
    // 滞期费
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  demurrage_invoice_demurrage_deduction: {
    // 滞期折扣
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  demurrage_receipt_uploadfile_id: {
    // 收据ID
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_receipt_no: {
    // 收据号
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_receipt_amount: {
    // 收据金额
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_invoice_date: {
    // 开票日期
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_receipt_date: {
    // 收据日期
    type: db.STRING(20),
    allowNull: true
  },
  demurrage_invoice_current_demurrage_amount: {
    // 当次发票金额
    type: db.STRING(20),
    allowNull: true
  }
})
