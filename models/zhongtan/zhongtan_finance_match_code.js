const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_match_code', {
  match_code_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  finance_subject_code: {
    // 科目编码
    type: db.STRING(20),
    allowNull: false
  },
  match_code_bill_type: {
    // 单据类别
    type: db.STRING(20),
    allowNull: false
  },
  match_code_business: {
    // 进出口
    type: db.STRING(100),
    allowNull: true
  },
  match_code_carrier: {
    // 船代
    type: db.STRING(100),
    allowNull: true
  },
  match_code_fee_type: {
    // 费用类别
    type: db.STRING(100),
    allowNull: true
  },
  match_code_fee_currency: {
    // 币种
    type: db.STRING(100),
    allowNull: true
  },
  match_code_fee_bank: {
    // 银行
    type: db.STRING(100),
    allowNull: true
  },
  match_code_fee_name: {
    // 费用名称
    type: db.STRING(50),
    allowNull: true
  }
})
