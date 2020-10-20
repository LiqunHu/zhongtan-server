const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_user = model.common_user
const tb_container_size = model.zhongtan_container_size

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, 
                  c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
                  from tbl_zhongtan_invoice_containers a 
                  LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
                  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id
                  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
                  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
                  WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data && doc.search_data.date && doc.search_data.date.length > 1) {
    let start_date = doc.search_data.date[0]
    let end_date = doc.search_data.date[1]
    queryStr += ` AND c.invoice_masterbi_id IN (SELECT u.uploadfile_index1 FROM tbl_zhongtan_uploadfile u WHERE u.api_name = 'OVERDUE-INVOICE' AND (u.uploadfile_receipt_no IS NULL OR u.uploadfile_receipt_no = '') AND NOT EXISTS(SELECT 1 FROM tbl_zhongtan_uploadfile su WHERE u.uploadfile_index1 = su.uploadfile_index1 AND su.api_name ='OVERDUE-RECEIPT') GROUP BY u.uploadfile_index1 HAVING MAX(u.created_at) >= ?  AND MAX(u.created_at) < ? ) `
    replacements.push(start_date)
    replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  } else {
    queryStr += `AND c.invoice_masterbi_id IN (SELECT u.uploadfile_index1 FROM tbl_zhongtan_uploadfile u WHERE u.api_name = 'OVERDUE-INVOICE' AND (u.uploadfile_receipt_no IS NULL OR u.uploadfile_receipt_no = '') AND NOT EXISTS(SELECT 1 FROM tbl_zhongtan_uploadfile su WHERE u.uploadfile_index1 = su.uploadfile_index1 AND su.api_name ='OVERDUE-RECEIPT')) `
  }
  if(doc.search_data) {
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  if(result.data) {
    for(let d of result.data) {
      if(d.invoice_containers_customer_id) {
        let customer = await tb_user.findOne({
          where: {
            user_id: d.invoice_containers_customer_id
          }
        })
        if(customer) {
          d.customerINFO = [
            {
              id: d.invoice_containers_customer_id,
              text: customer.user_name
            }
          ]
        }
      }

      d.files = []
      let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
          left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
          WHERE a.uploadfile_index1 = ? AND a.api_name IN('OVERDUE-INVOICE', 'OVERDUE-RECEIPT') ORDER BY a.uploadfile_id DESC`
      let replacements = [d.invoice_masterbi_id]
      let files = await model.simpleSelect(queryStr, replacements)
      if(files) {
        let fileType = 'INVOICE'
        for(let f of files) {
          if(f.api_name === 'OVERDUE-INVOICE') {
            fileType = 'INVOICE'
          } else {
            fileType = 'RECEIPT'
          }
          d.files.push({
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            state: f.uploadfile_state,
            file_type: fileType,
            demurrage: f.uploadfile_amount,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        }
      }
    }
  }
  returnData.rows = result.data

  return common.success(returnData)
}

exports.exportDataAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, 
                  c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
                  from tbl_zhongtan_invoice_containers a 
                  LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
                  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id
                  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
                  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
                  WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data && doc.search_data.date && doc.search_data.date.length > 1) {
    let start_date = doc.search_data.date[0]
    let end_date = doc.search_data.date[1]
    queryStr += ` AND c.invoice_masterbi_id IN (SELECT u.uploadfile_index1 FROM tbl_zhongtan_uploadfile u WHERE u.api_name = 'OVERDUE-INVOICE' AND (u.uploadfile_receipt_no IS NULL OR u.uploadfile_receipt_no = '') AND NOT EXISTS(SELECT 1 FROM tbl_zhongtan_uploadfile su WHERE u.uploadfile_index1 = su.uploadfile_index1 AND su.api_name ='OVERDUE-RECEIPT') GROUP BY u.uploadfile_index1 HAVING MAX(u.created_at) >= ?  AND MAX(u.created_at) < ? ) `
    replacements.push(start_date)
    replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  } else {
    queryStr += `AND c.invoice_masterbi_id IN (SELECT u.uploadfile_index1 FROM tbl_zhongtan_uploadfile u WHERE u.api_name = 'OVERDUE-INVOICE' AND (u.uploadfile_receipt_no IS NULL OR u.uploadfile_receipt_no = '') AND NOT EXISTS(SELECT 1 FROM tbl_zhongtan_uploadfile su WHERE u.uploadfile_index1 = su.uploadfile_index1 AND su.api_name ='OVERDUE-RECEIPT')) `
  }
  if(doc.search_data) {
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    renderData.push(r)
  }

  let filepath = await common.ejs2xlsx('OverdueSearchTemplate.xlsx', renderData)

  res.sendFile(filepath)
}

exports.exportAdminDataAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, 
                  c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
                  from tbl_zhongtan_invoice_containers a 
                  LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
                  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id
                  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
                  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
                  WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data && doc.search_data.date && doc.search_data.date.length > 1) {
    let start_date = doc.search_data.date[0]
    let end_date = doc.search_data.date[1]
    queryStr += ` AND c.invoice_masterbi_id IN (SELECT u.uploadfile_index1 FROM tbl_zhongtan_uploadfile u WHERE u.api_name = 'OVERDUE-INVOICE' AND (u.uploadfile_receipt_no IS NULL OR u.uploadfile_receipt_no = '') AND u.created_at >= ? and u.created_at < ? ) `
    replacements.push(start_date)
    replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  } else {
    queryStr += `AND c.invoice_masterbi_id IN (SELECT u.uploadfile_index1 FROM tbl_zhongtan_uploadfile u WHERE u.api_name = 'OVERDUE-INVOICE' AND (u.uploadfile_receipt_no IS NULL OR u.uploadfile_receipt_no = '')) `
  }
  if(doc.search_data) {
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    renderData.push(r)
  }

  let filepath = await common.ejs2xlsx('OverdueSearchAdminTemplate.xlsx', renderData)

  res.sendFile(filepath)
}
