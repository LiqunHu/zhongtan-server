const db = require('../../app/db')
// 航班表

module.exports = db.defineModel('tbl_zhongtan_container_yard', {
  container_yard_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  container_yard_name: {
    type: db.STRING(100),
    allowNull: false
  },
  container_yard_code: {
    // 航线编码
    type: db.STRING(30),
    allowNull: false
  }
})
