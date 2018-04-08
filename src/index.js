const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const router = express.Router();
const config = require('./config');

router.use(function (req, res, next) {
    res.header('protocol', '0.2');
    next();
});

const port = config.port;
app.use(bodyParser.json({extended: true}));
app.use('/', router);

require('./routes')(app);
app.listen(port, () => {
    console.log('We are live on ' + port);
});