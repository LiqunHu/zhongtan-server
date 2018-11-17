const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const MarkdownIt = require('../../../util/markdown.js')
const model = require('../../../model')

const tb_web_article = model.zhongtan_web_article
const tb_sail_schedule_upload = model.zhongtan_sail_schedule_upload
const tb_uploadfile = model.zhongtan_uploadfile

exports.WebResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'getHomePageBoard') {
    getHomePageBoardAct(req, res)
  } else if (method === 'getMessages') {
    getMessagesAct(req, res)
  } else if (method === 'getSchedule') {
    getScheduleAct(req, res)
  } else if (method === 'getArticle') {
    getArticleAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function getHomePageBoardAct(req, res) {
  try {
    let returnData = {
      data: {
        message: [],
        schedule: []
      }
    }

    let messages = await tb_web_article.findAll({
      where: {
        web_article_type: '1'
      },
      limit: 5,
      order: [['created_at', 'DESC']]
    })
    for (let m of messages) {
      returnData.data.message.push({
        web_article_id: m.web_article_id,
        web_article_title: m.web_article_title,
        created_at: moment(m.created_at).format('YYYY/MM/DD')
      })
    }

    let schedules = await tb_sail_schedule_upload.findAll({
      limit: 5,
      order: [['created_at', 'DESC']]
    })
    for (let s of schedules) {
      let row = {
        sail_schedule_upload_id: s.sail_schedule_upload_id,
        sail_schedule_upload_desc: s.sail_schedule_upload_desc,
        created_at: moment(s.created_at).format('YYYY/MM/DD'),
        files: []
      }
      let files = await tb_uploadfile.findAll({
        where: {
          api_name: 'SAILSCHEDULECONTROL',
          uploadfile_index1: s.sail_schedule_upload_id
        }
      })
      for (let f of files) {
        row.files.push({
          uploadfile_id: f.uploadfile_id,
          uploadfile_name: f.uploadfile_name,
          uploadfile_url: f.uploadfile_url
        })
      }
      returnData.data.schedule.push(row)
    }

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function getMessagesAct(req, res) {
  try {
    let returnData = {
      data: {
        messages: []
      }
    }

    let messages = await tb_web_article.findAll({
      where: {
        web_article_type: '1'
      },
      limit: 50,
      order: [['created_at', 'DESC']]
    })

    for (let m of messages) {
      returnData.data.messages.push({
        web_article_id: m.web_article_id,
        web_article_title: m.web_article_title,
        created_at: moment(m.created_at).format('YYYY/MM/DD')
      })
    }

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function getScheduleAct(req, res) {
  try {
    let returnData = {
      data: {
        schedule: []
      }
    }

    let schedule = await tb_sail_schedule_upload.findAll({
      limit: 50,
      order: [['created_at', 'DESC']]
    })
    for (let s of schedule) {
      let row = {
        sail_schedule_upload_id: s.sail_schedule_upload_id,
        sail_schedule_upload_desc: s.sail_schedule_upload_desc,
        created_at: moment(s.created_at).format('YYYY/MM/DD'),
        files: []
      }
      let files = await tb_uploadfile.findAll({
        where: {
          api_name: 'SAILSCHEDULECONTROL',
          uploadfile_index1: s.sail_schedule_upload_id
        }
      })
      for (let f of files) {
        row.files.push({
          uploadfile_id: f.uploadfile_id,
          uploadfile_name: f.uploadfile_name,
          uploadfile_url: f.uploadfile_url
        })
      }
      returnData.data.schedule.push(row)
    }

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function getArticleAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let article = await tb_web_article.findOne({
      where: {
        web_article_id: doc.web_article_id
      }
    })

    let returnData = JSON.parse(JSON.stringify(article))

    returnData.web_article_markdown = MarkdownIt.render(
      returnData.web_article_body
    )
    returnData.created_at = moment(article.created_at).format('YYYY/MM/DD')
    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}
