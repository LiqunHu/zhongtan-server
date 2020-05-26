const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_container_type', {
  container_type_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  container_type_code: {
    // 箱型代码
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_type_name: {
    // 箱型名称
    type: db.STRING(20),
    allowNull: false
  }
})
