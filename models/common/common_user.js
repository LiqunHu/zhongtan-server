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
    allowNull: false
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
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  user_phone: {
    type: db.STRING(100),
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
  },
  user_tin: {
    type: db.STRING(20),
    allowNull: true
  },
  user_blacklist: {
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: false
  },
  user_customer_type: {
    // 客户类型 0:ALL 1: agent 代理，2：consignee 收货人
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  user_vrn: {
    type: db.STRING(50),
    allowNull: true
  },
  user_bank_account_usd: {
    type: db.STRING(50),
    allowNull: true
  },
  user_bank_account_tzs: {
    type: db.STRING(50),
    allowNull: true
  },
  export_split_shipment: {
    type: db.JSON,
    allowNull: true
  },
  user_rate: {
    type: db.INTEGER(10),
    defaultValue: 1,
    allowNull: false
  },
  user_code: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: true
  },
  blacklist_from: {
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  u8_code: {
    // 用户U8系统代码
    type: db.STRING(50),
    allowNull: true
  },
  u8_alias: {
    // U8系统别名
    type: db.STRING(50),
    allowNull: true
  },
  blacklist_order: {
    // U8系统别名
    type: db.STRING(100),
    allowNull: true
  },
  u8_department_code: {
    // U8系统部门代码
    type: db.STRING(10),
    allowNull: true
  },
  u8_vendor_code: {
    // 用户U8系统供应商代码
    type: db.STRING(50),
    allowNull: true
  },
  u8_vendor_alias: {
    // U8系统供应商别名
    type: db.STRING(100),
    allowNull: true
  },
  user_attachment: {
    // U8系统供应商别名
    type: db.JSON,
    allowNull: true
  },
})
