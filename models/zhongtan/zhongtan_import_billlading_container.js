const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_import_billlading_container', {
  import_billlading_container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  import_billlading_id: {
    type: db.IDNO,
    allowNull: false
  },
  import_billlading_container_num: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_seal: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_type: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_package_cnt: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_cnt_unit: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_traffic_mode: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_weight: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  import_billlading_container_tare_weight: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
