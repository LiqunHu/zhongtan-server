const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_edi_mail', {
  edi_mail_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  mail_depot_name: {
    // 场站名称
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  mail_send_from: {
    // 发件人
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  mail_send_time: {
    // 发送时间
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  mail_receive_time: {
    // 接收时间
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  mail_send_subject: {
    // 主题
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  mail_send_attachment_name: {
    // 附件名称
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  mail_send_attachment_content: {
    // 附件内容
    type: db.TEXT
  },
  mail_edi_type: {
    // 类别 34: 进场, 36: 出场, 44: 卸船, 46：装船
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  mail_edi_bl: {
    // 提单号
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  mail_edi_container_no: {
    // 箱号
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  mail_edi_time: {
    // edi时间
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  }
})
