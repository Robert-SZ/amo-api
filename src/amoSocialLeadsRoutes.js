const config = require('./config');
const request = require('axios');


module.exports = function (app) {

    function sendToAmo(res, firstName, email, phone, utmCampaign, utmContent, utmMedium, utmSource, utmTerm, formName, requestBody) {
        let data = {
            firstName: firstName,
            email: email,
            phone: phone,
            utmCampaign: utmCampaign,
            utmContent: utmContent,
            utmMedium: utmMedium,
            utmSource: utmSource,
            utmTerm: utmTerm,
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
    }

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
        };
        return sendToAmo(res, data.firstName, data.email, data.phone, data.utmCampaign, data.utmContent, data.utmMedium,
            data.utmSource, data.utmTerm, data.formName, requestBody)
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

        return sendToAmo(res, data.firstName, data.email, data.phone, data.utmCampaign, data.utmContent, data.utmMedium,
            data.utmSource, data.utmTerm, data.formName, requestBody)
    });

    app.get('/fblead', (req, res) => {
        let mode = req.query["hub.mode"];
        let challenge = req.query["hub.challenge"];
        let verifyToken = req.query["hub.verify_token"];
        const correctVerifyToken = config.facebookVerifyToken;

        if (mode !== "subscribe" || verifyToken !== correctVerifyToken) {
            return res.status(403).send("");
        }

        return res.status(200).send(challenge);
    });

    app.post('/fblead', (req, res) => {

        if (!req.body.object || req.body.object !== 'page')
            return res.status(409).send('object page is not exists');

        if (!req.body.entry && !req.body.entry.changes) {
            return res.status(409).send('entry.changes is not exists');
        }

        let entryArr = req.body.entry;

        let url = config.facebookApi;
        let pageAccessToken = config.facebookPageAccessToken;


        entryArr.forEach(entry => {
            if (entry.changes) {
                let changesArr = entry.changes;

                changesArr.forEach(change => {
                    if (change.field && change.field === "leadgen") {
                        if (change.value && change.value.leadgen_id) {
                            let leadGenId = change.value.leadgen_id;
                            let leadInfoUrl = `${url}/v2.12/${leadGenId}?fields=campaign_id,campaign_name,ad_id,field_data&access_token=${pageAccessToken}`;
                            const getFieldDataValue = (fieldData, prop) => {
                                let obj = fieldData.filter(item => item.name === prop)[0];
                                return (obj && obj.values && obj.values[0]) || "";
                            };
                            return request.get(leadInfoUrl)
                                .then(result => {

                                    let data = result.data;
                                    let utmCampaign = data.campaign_name;
                                    let utmContent = data.ad_id;
                                    let utmMedium = "cpm";
                                    let utmSource = "facebook";
                                    let fieldData = data.field_data;
                                    let firstName = getFieldDataValue(fieldData, "first_name");
                                    let lastName = getFieldDataValue(fieldData, "last_name");
                                    let name = firstName + " " + lastName;
                                    let phone = getFieldDataValue(fieldData, "phone_number");
                                    let email = getFieldDataValue(fieldData, "email");

                                    return sendToAmo(res, name, email, phone, utmCampaign, utmContent, utmMedium, utmSource, null, null, data);
                                })
                                .catch((error) => {
                                    res.status(500).send('cant get lead info');
                                })

                        }
                    }
                });
            }
        });
    });
};