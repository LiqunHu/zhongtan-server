const db = require('../../util/db');

module.exports = db.defineModel('tbl_zhongtan_container', {
  container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billloading_id: { // 提单号
    type: db.STRING(100),
  },
  container_type: { // 集装箱类型
    type: db.STRING(20)
  },
  container_size: { // 集装箱大小
    type: db.STRING(20)
  },
  container_iso: { // 集装箱ISO 型号
    type: db.STRING(20)
  },
  container_gross_weight: { // 毛重
    type: db.STRING(20)
  }
});