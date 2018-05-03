var request = require('axios');

module.exports = function (app) {
    app.post('/vklead', (req, res) => {

        if (req.body.type === 'confirmation')
            return res.status(200).send('842954d1');

        let requestBody = req.body.object;
        if (!requestBody)
            return res.status(409).send('object body is not exists');
        let answers = requestBody.answers || [];
        let firstName = answers.filter(item => item.key === 'first_name')[0] || 'Заявка с VK';
        let email = answers.filter(item => item.key === 'email')[0];
        let phone = answers.filter(item => item.key === 'phone_number')[0];
        let a_aid = requestBody.ad_id;
        let formName = requestBody.form_name;

        if (!email && !phone)
            return res.status(409).send('required fields are not exists');


        let data = {
            firstName: firstName && firstName.answer,
            email: email && email.answer,
            phone: phone && phone.answer,
            utmCampaign: undefined,
            utmContent: a_aid,
            utmMedium: "cpm",
            utmSource: "vk",
            utmTerm: undefined,
            formName: formName,
            comment: JSON.stringify(requestBody)
        };

        return request.post('https://api.amocore.in/modulkassa/integration/modulkassa/ouvyse51de1vrzvzchnrnnhvqtheqt09', data)
            .then(() => {
                res.status(200).send('ok')
            })
            .catch(() => {
                res.status(500).send('cant write to amo')
            });
    });

    app.post('/oklead', (req, res) => {

        if (!req.body.resource || req.body.resource !== 'OKLEADAD')
            return res.status(409).send('resource is not exists');

        let requestBody = req.body.diff;
        if (!requestBody)
            return res.status(409).send('diff body is not exists');
        let firstName = (requestBody.user_fullname && requestBody.user_fullname['+++']) || 'Заявка с OK';
        let email = requestBody.user_email && requestBody.user_email['+++'];
        let phone = requestBody.user_phone && requestBody.user_phone['+++'];
        let a_aid = requestBody.banner_id && requestBody.banner_id['+++'];
        let formName = requestBody.form_id && requestBody.form_id['+++'];

        if (!email && !phone)
            return;

        phone = phone.replace(' ', '');

        let data = {
            firstName: firstName,
            email: email,
            phone: phone,
            utmCampaign: undefined,
            utmContent: a_aid,
            utmMedium: "cpm",
            utmSource: "ok",
            utmTerm: undefined,
            formName: formName,
            comment: JSON.stringify(requestBody)
        };

        return request.post('https://api.amocore.in/modulkassa/integration/modulkassa/ouvyse51de1vrzvzchnrnnhvqtheqt09', data)
            .then(() => {
                res.status(200).send('ok')
            })
            .catch(() => {
                res.status(500).send('cant write to amo')
            });
    });
};