const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_invoice_verification_log', {
  verification_log_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_masterbi_id: {
    type: db.IDNO,
    allowNull: false
  },
  uploadfile_id: {
    type: db.IDNO,
    allowNull: false
  },
  user_id: {
    // verification user
    type: db.UUID,
    allowNull: true
  },
  api_name: {
    type: db.STRING(100),
    allowNull: false
  },
  uploadfile_state: {
    // 文件状态
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  uploadfile_state_pre: {
    // 文件状态修改前
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
