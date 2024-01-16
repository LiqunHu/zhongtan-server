const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_ought_receive_detail', {
  ought_receive_detail_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  ought_receive_id: {
    // 应收单ID
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_code: {
    //费用U8科目编码
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_fee_code: {
    // 费用代码
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_fee_name: {
    // 费用名称
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_amount: {
    // 收据金额
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_natamount: {
    // 本币金额
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_original_amount: {
    // 原币金额
    type: db.STRING(20),
    allowNull: false
  },
  ought_receive_detail_digest: {
    // 描述
    type: db.STRING(50),
    allowNull: true
  },
  ought_received_detail_code: {
    // 收款单科目
    type: db.STRING(20),
    allowNull: true
  },
  ought_received_detail_digest: {
    // 收款单描述
    type: db.STRING(50),
    allowNull: true
  }
})
