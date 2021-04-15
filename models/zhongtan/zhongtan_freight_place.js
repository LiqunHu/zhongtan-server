const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_freight_place', {
  freight_place_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  freight_place_code: {
    // 代码
    type: db.STRING(20),
    allowNull: false
  },
  freight_place_name: {
    // 名称
    type: db.STRING(20),
    allowNull: false
  }
})
