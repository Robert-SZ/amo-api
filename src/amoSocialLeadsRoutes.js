var request = require('axios');

module.exports = function (app) {
    app.post('/vklead', (req, res) => {

        if (req.body.type === 'confirmation')
            return res.status(200).send('842954d1');

        let requestBody = req.body.object;
        if (!requestBody)
            return;
        let answers = requestBody.answers || [];
        let firstName = answers.filter(item => item.key === 'first_name')[0] || 'Заявка с VK';
        let email = answers.filter(item => item.key === 'email')[0];
        let phone = answers.filter(item => item.key === 'phone_number')[0];
        let a_aid = requestBody.ad_id;
        let formName = requestBody.form_name;

        if (!email && !phone)
            return;


        let data = {
            firstName: firstName && firstName.answer,
            email: email && email.answer,
            phone: phone && phone.answer,
            utmCampaign: "(none)",
            utmContent: "(none)",
            utmMedium: "(none)",
            utmSource: "vk",
            utmTerm: "(none)",
            formName: formName,
            comment: JSON.stringify(requestBody),
            a_aid: a_aid
        };

        return request.post('https://api.amocore.in/modulkassa/integration/modulkassa/ouvyse51de1vrzvzchnrnnhvqtheqt09', data)
            .then(()=>{res.status(200).send('ok')})
            .catch(()=>{res.status(500).send('cant write to amo')});


    });
};