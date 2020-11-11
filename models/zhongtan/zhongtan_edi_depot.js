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
    defaultValue: '',
    allowNull: false
  },
  edi_depot_cnt_regex: {
    // 箱号正则
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  edi_depot_dmt_regex: {
    // 还箱时间正则
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  edi_depot_dmt_format: {
    // 时间格式
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  edi_depot_storing_order_email: {
    // 场站接收storing order邮箱地址
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  edi_depot_gate_in_out_regex: {
    // 判断GATE IN/OUT
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  edi_depot_send_edi: {
    // 是否发送edi文件
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  edi_depot_send_edi_email: {
    // 发送edi文件的邮箱
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
})
