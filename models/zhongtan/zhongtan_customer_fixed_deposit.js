const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_customer_fixed_deposit', {
  fixed_deposit_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  fixed_deposit_customer_id: {
    // fixed_deposit_type
    type: db.STRING(36),
    allowNull: false
  },
  fixed_deposit_type: {
    // fixed_deposit_type
    type: db.STRING(50),
    allowNull: false
  },
  deposit_begin_date: {
    // deposit_begin_date
    type: db.DATE,
    allowNull: true
  },
  deposit_expire_date: {
    // deposit_expire_date
    type: db.DATE,
    allowNull: true
  },
  deposit_long_term: {
    // deposit_long_term
    type: db.STRING(1),
    allowNull: true
  },
  deposit_guarantee_letter_no: {
    // deposit_guarantee_letter_no
    type: db.STRING(50),
    allowNull: true
  },
  deposit_amount: {
    // deposit_amount
    type: db.STRING(50),
    allowNull: true
  },
  deposit_currency: {
    // deposit_currency
    type: db.STRING(10),
    allowNull: true
  },
  deposit_check_cash: {
    // deposit_check_cash
    type: db.STRING(10),
    allowNull: true
  },
  deposit_check_cash_no: {
    // deposit_check_cash_no
    type: db.STRING(10),
    allowNull: true
  },
  deposit_invoice_date: {
    // deposit_invoice_date
    type: db.DATE,
    allowNull: true
  },
  deposit_invoice_release_date: {
    // deposit_release_date
    type: db.DATE,
    allowNull: true
  },
  deposit_receipt_no: {
    // deposit_receipt_no
    type: db.STRING(50),
    allowNull: true
  },
  deposit_receipt_date: {
    // deposit_receipt_date reci
    type: db.DATE,
    allowNull: true
  },
  deposit_receipt_release_date: {
    // deposit_receipt_date reci
    type: db.DATE,
    allowNull: true
  },
  deposit_approve_date: {
    // deposit_approve_date 审核日期
    type: db.DATE,
    allowNull: true
  },
  deposit_work_state: {
    // deposit_work_state 是否有效
    type: db.STRING(2),
    allowNull: true
  },
  deposit_invalid_date: {
    // deposit_invalid_date 作废日期
    type: db.DATE,
    allowNull: true
  },
  deposit_invalid_user_id: {
    // user_id 作废Userid
    type: db.STRING(36),
    allowNull: true
  },
  user_id: {
    // user_id
    type: db.STRING(36),
    allowNull: false
  }
})
