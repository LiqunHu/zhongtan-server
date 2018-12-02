const db = require('../../util/db')
// 航班表

module.exports = db.defineModel('tbl_zhongtan_container_manager', {
  container_manager_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  container_manager_name: {
    type: db.STRING(100),
    allowNull: false
  },
  container_manager_code: {
    // 航线编码
    type: db.STRING(30),
    allowNull: false
  }
})
