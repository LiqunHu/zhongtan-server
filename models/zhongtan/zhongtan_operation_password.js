const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_operation_password', {
  operation_password_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  operation_desc: {
    // 描述说明
    type: db.STRING(50),
    allowNull: false
  },
  operation_page: {
    // 页面
    type: db.STRING(20),
    allowNull: false
  },
  operation_action: {
    // 动作
    type: db.STRING(20),
    allowNull: false
  },
  operation_password: {
    // 密码
    type: db.STRING(50),
    allowNull: false
  }
})
