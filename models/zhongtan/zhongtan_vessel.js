const db = require('../../app/db')
// 船表

module.exports = db.defineModel('tbl_zhongtan_vessel', {
  vessel_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  vessel_service_name: {
    type: db.STRING(20),
    allowNull: false
  },
  vessel_name: {
    // 船名
    type: db.STRING(100),
    unique: 'vessel_name',
    allowNull: false
  },
  vessel_operator: {
    // 所有者
    type: db.STRING(20)
  },
  vessel_code: {
    // 船编码
    type: db.STRING(20),
    unique: 'vessel_code',
    allowNull: false
  }
})
