const express = require('express')
const services = require('./service')
const router = express.Router()

router.post('/export/Booking/:method', services.BookingSRV.BookingResource);
router.post('/web/WebControl/:method', services.WebControlSRV.WebControlResource);
router.post('/web/Web/:method', services.WebSRV.WebResource);

module.exports = router
