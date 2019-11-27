/* 用户表 */
const CryptoJS = require('crypto-js')
const db = require('../../app/db')

module.exports = db.defineModel('tbl_common_user', {
  user_id: {
    type: db.UUID,
    defaultValue: db.UUIDV1,
    primaryKey: true
  },
  user_username: {
    type: db.STRING(100),
    allowNull: false,
    unique: true
  },
  user_wx_openid: {
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  user_type: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  user_email: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  user_phone: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  user_password: {
    type: db.STRING(100),
    allowNull: false,
    set: function(val) {
      this.setDataValue('user_password', CryptoJS.MD5(val).toString())
    }
  },
  user_name: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  user_gender: {
    type: db.STRING(1),
    defaultValue: '',
    allowNull: false
  },
  user_avatar: {
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  user_province: {
    //省
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  user_city: {
    //市/县
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  user_district: {
    //区
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  user_address: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  user_address1: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  user_address2: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  user_zipcode: {
    type: db.STRING(32),
    defaultValue: '',
    allowNull: false
  },
  user_service_name: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  user_remark: {
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  }
})
