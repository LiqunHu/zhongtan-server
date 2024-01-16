const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_receive_split', {
  receive_split_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  ought_receive_id: {
    // 应收单ID
    type: db.STRING(20),
    allowNull: false
  },
  receive_split_amount: {
    //费用U8科目编码
    type: db.STRING(20),
    allowNull: false
  },
  receive_split_natamount: {
    // 费用代码
    type: db.STRING(20),
    allowNull: true
  },
  receive_split_original_amount: {
    // 费用名称
    type: db.STRING(20),
    allowNull: true
  },
  receive_split_bank: {
    // 收据金额
    type: db.STRING(10),
    allowNull: true
  },
  receive_split_currency: {
    // 本币金额
    type: db.STRING(10),
    allowNull: true
  },
  receive_split_reference_no: {
    // 原币金额
    type: db.STRING(20),
    allowNull: true
  },
  receive_split_subject_code: {
    // 描述
    type: db.STRING(50),
    allowNull: true
  },
  receive_split_received_no: {
    // 收款单科目
    type: db.STRING(50),
    allowNull: true
  },
  receive_split_u8_id: {
    // 收款单描述
    type: db.STRING(50),
    allowNull: true
  },
  receive_split_trade_id: {
    // 收款单描述
    type: db.STRING(50),
    allowNull: true
  },
  receive_split_u8_biz_id: {
    // 收款单描述
    type: db.STRING(50),
    allowNull: true
  }
})
