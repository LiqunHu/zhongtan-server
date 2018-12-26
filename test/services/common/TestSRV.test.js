// process.env.NODE_ENV = 'test'
const request = require('supertest')
const should = require('should')
const app = require('../../../app')

describe('TestSRV', () => {
  describe('POST /api/test/test/search', () => {
    it('response with data property', function (done) {
      request(app)
        .post('/api/test/test/search')
        .end(function (err, res) {
          should(res.body.info).have.property('aaaa', 1111)
          done()
        })
    })
  })
})
