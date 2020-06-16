const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_edi_depot', {
  edi_depot_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  edi_depot_name: {
    // 场站名称
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  edi_depot_sender_email: {
    // 场站发送edi邮箱地址
    type: db.STRING(50),
    allowNull: false
  },
  edi_depot_cnt_regex: {
    // 箱号正则
    type: db.STRING(50),
    allowNull: false
  },
  edi_depot_dmt_regex: {
    // 还箱时间正则
    type: db.STRING(50),
    allowNull: false
  },
  edi_depot_dmt_format: {
    // 时间格式
    type: db.STRING(50),
    allowNull: false
  }
})