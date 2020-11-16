const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_export_verification_log', {
  verification_log_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_masterbi_id: {
    type: db.IDNO,
    allowNull: false
  },
  export_verification_id: {
    type: db.IDNO,
    allowNull: false
  },
  user_id: {
    type: db.UUID,
    allowNull: true
  },
  api_name: {
    type: db.STRING(100),
    allowNull: false
  },
  verification_state: {
    // 文件状态
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  verification_state_pre: {
    // 文件状态修改前
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
