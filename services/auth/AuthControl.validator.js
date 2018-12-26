const Joi = require('joi')

module.exports = {
  name: 'Auth Services',
  apiList: {
    signin: {
      name: '登陆授权',
      enname: 'signin',
      tags: ['Auth'],
      path: '/api/auth/signin',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          login_type: Joi.string().allow('WEB', 'MOBILE'),
          username: Joi.string().max(100),
          identify_code: Joi.string().max(100),
          magic_no: Joi.string().max(100)
        })
      }
    },
    signinBySms: {
      name: '验证码登陆授权',
      enname: 'signinBySms',
      tags: ['Auth'],
      path: '/api/auth/signinBySms',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          login_type: Joi.string().allow('WEB', 'MOBILE'),
          user_phone: Joi.string().regex(/^1[3|4|5|7|8]\d{9}$/),
          code: Joi.string()
        })
      }
    },
    signinByWx: {
      name: '微信登陆授权',
      enname: 'signinByWx',
      tags: ['Auth'],
      path: '/api/auth/signinByWx',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          wx_code: Joi.string()
        })
      }
    },
    signout: {
      name: '登出',
      enname: 'signout',
      tags: ['Auth'],
      path: '/api/auth/signout',
      type: 'post',
      JoiSchema: {}
    },
    sms: {
      name: '获取短信验证码',
      enname: 'sms',
      tags: ['Auth'],
      path: '/api/auth/sms',
      type: 'post',
      JoiSchema: {
        body: Joi.object().keys({
          user_phone: Joi.string().regex(/^1[3|4|5|7|8]\d{9}$/)
        })
      }
    },
    captcha: {
      name: '获取图片验证码',
      enname: 'captcha',
      tags: ['Auth'],
      path: '/api/auth/captcha',
      type: 'post',
      JoiSchema: {}
    }
  }
}
