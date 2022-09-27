const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_unusual_invoice', {
  unusual_invoice_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  unusual_invoice_party: {
    // 客户
    type: db.STRING(50),
    allowNull: false
  },
  unusual_invoice_items: {
    // 类别
    type: db.STRING(20),
    allowNull: false
  },
  unusual_invoice_cargo_type: {
    // 本地过境
    type: db.STRING(50),
    allowNull: false
  },
  unusual_invoice_amount: {
    // 金额
    type: db.STRING(20),
    allowNull: false
  },
  unusual_invoice_bl: {
    // 提单号
    type: db.STRING(20),
    allowNull: false
  },
  unusual_invoice_vessel: {
    // 船名
    type: db.STRING(50),
    allowNull: true
  },
  unusual_invoice_voyaga: {
    // 航次
    type: db.STRING(50),
    allowNull: true
  },
  unusual_invoice_no: {
    // 发票编号
    type: db.STRING(20),
    allowNull: true
  },
  unusual_invoice_date: {
    // 发票日期
    type: db.STRING(20),
    allowNull: true
  },
  unusual_receipt_no: {
    // 收据编号
    type: db.STRING(50),
    allowNull: true
  },
  unusual_receipt_date: {
    // 收据日期
    type: db.STRING(20),
    allowNull: true
  },
  unusual_invoice_status: {
    // 状态
    type: db.STRING(20),
    allowNull: false
  }
})
