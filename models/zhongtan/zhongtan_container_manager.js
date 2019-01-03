const db = require('../../app/db')
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
  container_manager_email: {
    type: db.STRING(100),
    allowNull: false
  },
})
