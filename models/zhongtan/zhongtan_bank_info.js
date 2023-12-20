const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_bank_info', {
  bank_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  bank_code: {
    // 银行代码
    type: db.STRING(20),
    allowNull: false
  },
  bank_name: {
    // 银行名称
    type: db.STRING(50),
    allowNull: false
  },
  bank_remark: {
    // 银行备注
    type: db.STRING(50),
    allowNull: true
  }
})
