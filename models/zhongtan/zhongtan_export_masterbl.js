const db = require('../../app/db')
const GLBConfig = require('../../util/GLBConfig')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_masterbl', {
  export_masterbl_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_vessel_id: {
    // 船信息
    type: db.IDNO,
    allowNull: false
  },
  export_masterbl_bl_carrier: {
    // CARRIER
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_bl: {
    // 提单号
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_cso_number: {
    // CSO号
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_shipper_company: {
    // 发货人
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_forwarder_company: {
    // 货代
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_consignee_company: {
    // 收货人
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_port_of_load: {
    // 起运港默认TZDAR
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_port_of_discharge: {
    // 卸货港
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_traffic_mode: {
    // 运输方式
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_container_quantity: {
    // 箱总量
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_container_weight: {
    // 箱总重
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_cargo_nature: {
    // 货物属性
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_cargo_descriptions: {
    // 货物描述
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_empty_release_agent: {
    // 放箱代理
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_empty_release_depot: {
    // 放箱堆场
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_empty_release_date: {
    // 放箱日期
    type: db.DATE,
    allowNull: true
  },
  export_masterbl_empty_release_valid_to: {
    // 放箱有效期
    type: db.DATEONLY,
    allowNull: true
  },
  export_masterbl_empty_release_approve_date: {
    // 放箱审核日期
    type: db.DATE,
    allowNull: true
  },
  export_masterbl_agent_staff: {
    // agent
    type: db.JSON,
    allowNull: true
  },
  export_masterbl_cargo_type: {
    // 放箱堆场
    type: db.STRING(10),
    defaultValue: 'LOCAL',
    allowNull: false
  },
  export_masterbl_firm_booking: {
    // 放箱堆场
    type: db.STRING(10),
    defaultValue: 'NO',
    allowNull: false
  },
  export_masterbl_firm_booking_user: {
    // 放箱堆场
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_firm_booking_time: {
    // 放箱堆场
    type: db.STRING(20),
    allowNull: true
  },
  export_masterbl_forwarder_company_input: {
    // 货代录入
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_traffic_mode_input: {
    // 运输方式录入
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_rollover_charge: {
    // ROLLOVER CHARGE/SPACE LOSS
    type: db.STRING(5),
    defaultValue: GLBConfig.DISABLE,
    allowNull: false
  },
  export_masterbl_sales_code: {
    // sales code
    type: db.STRING(50),
    allowNull: true
  }
})
