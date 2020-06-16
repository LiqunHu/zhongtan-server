const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_container_size', {
  container_size_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  container_size_code: {
    // 箱尺寸代码
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_size_name: {
    // 箱尺寸名称
    type: db.STRING(20),
    allowNull: false
  }
})