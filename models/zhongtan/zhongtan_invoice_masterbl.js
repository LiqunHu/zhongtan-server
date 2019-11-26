const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_masterbl', {
  invoice_masterbi_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_vessel_id: {
    type: db.IDNO,
    allowNull: false
  },
  invoice_vessel_release_state: {
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: false
  },
  invoice_vessel_release_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_masterbi_bl: {
    // #M B/L No
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_cargo_type: {
    // Cargo Classification
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_bl_type: {
    // *B/L Type
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_destination: {
    // Place of Destination
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_delivery: {
    // Place of Delivery
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_oil_type: {
    // Oil Type
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_loading: {
    // Port of Loading
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_container_no: {
    // Number of Containers
    type: db.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  invoice_masterbi_goods_description: {
    // Description of Goods
    type: db.STRING(500),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_package_no: {
    // Number of Package
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_package_unit: {
    // Package Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_gross_weight: {
    // Gross Weight
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_gross_weight_unit: {
    // Gross Weight Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_gross_volume: {
    // Gross Volume
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_gross_volume_unit: {
    // Gross Volume Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_invoice_value: {
    // Invoice Value
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_invoice_currency: {
    // Invoice Currency
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_freight_charge: {
    // Freight Charge
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_freight_currency: {
    // Freight Currency
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_imdg: {
    // IMDG Code
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_packing_type: {
    // Packing Type
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_forwarder_code: {
    // Forwarder Code
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_forwarder_name: {
    // Forwarder Name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_forwarder_tel: {
    // Forwarder Tel
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_exporter_name: {
    // Exporter Name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_exporter_tel: {
    // Exporter Tel
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_exporter_address: {
    // Exporter Address
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_exporter_tin: {
    // Exporter TIN
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_consignee_name: {
    // Consignee Name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_consignee_tel: {
    // Consignee Tel
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_consignee_address: {
    // Consignee Address
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_consignee_tin: {
    // Consignee TIN
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_notify_name: {
    // Notify Name
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_notify_tel: {
    // Notify Tel
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_notify_address: {
    // Notify Address
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_notify_tin: {
    // Notify TIN
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_shipping_mark: {
    // Shipping Mark
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_net_weight: {
    // Net Weight
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_net_weight_unit: {
    // Net Weight Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_line_code: {
    // LineAgent Code
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_terminal_code: {
    // TerminalCode
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_delivery_to: {
    // Delivery To
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_do_date: {
    // Delivery To
    type: db.DATEONLY,
    allowNull: true
  },
  invoice_masterbi_valid_to: {
    // Delivery To
    type: db.DATEONLY,
    allowNull: true
  },
  invoice_masterbi_customer_id: {
    type: db.UUID,
    allowNull: true
  },
  invoice_masterbi_carrier: {
    // Carrier
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_deposit: {
    // Deposit
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_deposit_date: {
    // Deposit data
    type: db.DATEONLY,
    allowNull: true
  },
  invoice_masterbi_fee_date: {
    // Deposit data
    type: db.DATEONLY,
    allowNull: true
  },
  invoice_masterbi_transfer: {
    // CONTAINER TRANSFER
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_lolf: {
    // LIFT ON LIFT OFF
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_lcl: {
    // LCL FEE
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_amendment: {
    // AMENDMENT FEE
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_tasac: {
    // TASAC
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_masterbi_printing: {
    // BILL PRINGTING FEE
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  }
})
