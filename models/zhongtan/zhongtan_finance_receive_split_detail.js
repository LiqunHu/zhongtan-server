const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_receive_split_detail', {
  split_detail_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  receive_split_id: {
    // 应收单ID
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_id: {
    // 应收单ID
    type: db.STRING(20),
    allowNull: false
  },
  split_detail_amount: {
    //费用U8科目编码
    type: db.STRING(20),
    allowNull: false
  },
  split_detail_natamount: {
    // 费用代码
    type: db.STRING(20),
    allowNull: false
  },
  split_detail_original_amount: {
    // 费用名称
    type: db.STRING(20),
    allowNull: false
  },

  split_detail_code: {
    // 费用名称
    type: db.STRING(20),
    allowNull: false
  },
  split_detail_fee_code: {
    // 费用名称
    type: db.STRING(20),
    allowNull: false
  },
  split_detail_fee_name: {
    // 费用名称
    type: db.STRING(20),
    allowNull: false
  }
})
