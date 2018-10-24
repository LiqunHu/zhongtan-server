const db = require('../../util/db');
// 船表

module.exports = db.defineModel('tbl_zhongtan_vessel', {
  vessel_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  vessel_name: { // 船名
    type: db.STRING(100)
  },
  vessel_operator: { // 所有者
    type: db.STRING(20)
  },
  vessel_code: { // 船编码
    type: db.STRING(20)
  }
});