const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_payment_advice', {
  payment_advice_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  payment_advice_no: {
    // 支付编号
    type: db.STRING(50),
    allowNull: true
  },
  payment_advice_method: {
    // 支付方式
    type: db.STRING(20),
    allowNull: false
  },
  payment_advice_items: {
    // 费用项
    type: db.STRING(50),
    allowNull: false
  },
  payment_advice_inv_cntrl: {
    // INVOICE号或者CONTROL号
    type: db.STRING(20),
    allowNull: false
  },
  payment_advice_beneficiary: {
    // 收款方
    type: db.STRING(20),
    allowNull: false
  },
  payment_advice_amount: {
    // 金额
    type: db.STRING(20),
    allowNull: false
  },
  payment_advice_currency: {
    // 币种
    type: db.STRING(20),
    allowNull: false
  },
  payment_advice_bank_account: {
    // 收款方银行账号
    type: db.STRING(50),
    allowNull: false
  },
  payment_advice_remarks: {
    // 客户
    type: db.STRING(20),
    allowNull: false
  },
  payment_advice_status: {
    // 状态
    type: db.STRING(20),
    allowNull: false
  }
})
