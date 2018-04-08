const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const router = express.Router();

router.use(function (req, res, next) {
    res.header('protocol', '0.2');
    next();
});

const port = 8005;
app.use(bodyParser.json({extended: true}));
app.use('/', router);

require('./routes')(app);
app.listen(port, () => {
    console.log('We are live on ' + port);
});