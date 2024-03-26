const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_payable', {
  finance_payable_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_advice_id: {
    // 关联应收
    type: db.STRING(20),
    allowNull: false
  },
  finance_payable_amount: {
    // 金额
    type: db.STRING(20),
    allowNull: false
  },
  finance_payable_currency: {
    // 币种
    type: db.STRING(10),
    allowNull: false
  },
  finance_payable_natamount: {
    // 本币
    type: db.STRING(20),
    allowNull: true
  },
  finance_payable_original_amount: {
    // 原币
    type: db.STRING(20),
    allowNull: true
  },
  finance_payable_rate: {
    // 应付汇率
    type: db.STRING(20),
    allowNull: true
  },
  finance_payable_code: {
    // 应付表头科目
    type: db.STRING(20),
    allowNull: true
  },
  finance_payable_entry_code: {
    // 应付表体科目
    type: db.STRING(20),
    allowNull: true
  },
  finance_payment_code: {
    // 付款表头科目
    type: db.STRING(20),
    allowNull: true
  },
  finance_payment_entry_code: {
    // 付款表体科目
    type: db.STRING(20),
    allowNull: true
  },
  finance_payable_u8_id: {
    // 应付U8编号
    type: db.STRING(50),
    allowNull: true
  },
  finance_payable_u8_trade_id: {
    // 应付交易ID
    type: db.STRING(50),
    allowNull: true
  },
  finance_payment_u8_id: {
    // 付款U8编号
    type: db.STRING(50),
    allowNull: true
  },
  finance_payment_u8_trade_id: {
    // 付款U8交易ID
    type: db.STRING(50),
    allowNull: true
  },
  finance_payable_item: {
    type: db.STRING(20),
    allowNull: true
  },
  finance_payable_entry_item: {
    type: db.STRING(20),
    allowNull: true
  },
  finance_payment_item: {
    type: db.STRING(20),
    allowNull: true
  },
  finance_payment_entry_item: {
    type: db.STRING(20),
    allowNull: true
  },
  finance_payment_at: {
    // 付款单时间
    type: db.DATE,
    allowNull: true
  },
  finance_payable_order_no: {
    // 应付单编号
    type: db.STRING(50),
    allowNull: true
  },
  finance_payment_order_no: {
    // 付款单编号
    type: db.STRING(50),
    allowNull: true
  },
  finance_payment_date: {
    // 实际付款日期
    type: db.STRING(20),
    allowNull: true
  },
})
