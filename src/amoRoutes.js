const mongoClient = require('mongodb').MongoClient;
const mongoDbQueue = require('mongodb-queue');


const config = require('./config');

const amoClient2 = require('./amoClient2');
const amo = new amoClient2(config.amourl);

const login = config.amologin;
const key = config.amokey;
let mongodbConn = config.mongoConn;


module.exports = function (app) {

    function createContact(name, phone, email, leadId) {
        return {
            name: name,
            linked_leads_id: leadId,
            custom_fields: [
                getEnumField(42979, phone, "WORK"),//Телефон
                getEnumField(42981, email, "WORK"),//Email
            ]
        }
    }

    function createCompany(name, leadId, inn, ogrn, rs, bik, address, address_delivery) {
        return {
            name: name,
            linked_leads_id: leadId,
            custom_fields: [
                getEnumField(110875, inn),
                getEnumField(110889, ogrn),
                getEnumField(114287, bik),
                getEnumField(114291, rs),
                getEnumField(150105, address)
            ]
        }
    }

    mongoClient.connect(mongodbConn, function (err, db) {
            if (err) throw err;
            let dbo = db.db("leadsDB");
            dbo.createCollection("leads-queue", function (err) {
                    if (err) throw err;

                    let amoQueue = mongoDbQueue(dbo, 'amo-queue');
                    let amoAuthQueue = mongoDbQueue(dbo, 'amo-auth-queue');

                    let needAuth = true;

                    function getMessage() {
                        let promise = new Promise((resolve) => {

                            if (needAuth) {
                                amoAuthQueue.get((err, msg) => {
                                    if (msg) {
                                        resolve(getAuthPromise());
                                        amoAuthQueue.ack(msg.ack, () => {
                                            console.log('Auth Ack ' + JSON.stringify(msg.payload));
                                        })
                                    } else {
                                        resolve();
                                    }
                                });
                            } else {
                                amoQueue.get(function (err, msg) {
                                    if (msg) {
                                        switch (msg.payload.type) {
                                            case 'lead':
                                                resolve(addLead(msg.payload.payload).then(() => {
                                                    amoQueue.ack(msg.ack, function (err, id) {
                                                        console.log('Lead Ack ' + JSON.stringify(msg.payload));
                                                    })
                                                }));
                                                break;
                                            case 'contact':
                                                resolve(addContact(msg.payload.payload).then(() => {
                                                    amoQueue.ack(msg.ack, function (err, id) {
                                                        console.log('Contact Ack ' + JSON.stringify(msg.payload));
                                                    })
                                                }));
                                                break;
                                            case 'company':
                                                resolve(addCompany(msg.payload.payload).then(() => {
                                                    amoQueue.ack(msg.ack, function (err, id) {
                                                        console.log('Company Ack ' + JSON.stringify(msg.payload));
                                                    })
                                                }));
                                            default:
                                                resolve();
                                        }
                                    } else {
                                        resolve();
                                    }
                                });
                            }
                        });

                        promise.catch(error => {
                            console.log('Error ' + error);
                            if (error.response && error.response.status === 401) {
                                needAuth = true;
                                amoAuthQueue.add('auth', function (err, id) {
                                    console.log('Auth added to queue ' + id);
                                });
                            }
                            return {error}
                        }).then((data) => {
                            if (data && data.response && data.response.auth) {
                                needAuth = false;
                            }
                        }).then(() => {
                            setTimeout(getMessage, 1000);
                        })

                    }

                    app.post('/addLead', (req, res) => {
                        let data = {
                            name: req.body.firstName,
                            email: req.body.email,
                            phone: req.body.phone,
                            utmCampaign: req.body.utmCampaign,
                            utmContent: req.body.utmContent,
                            utmMedium: req.body.utmMedium,
                            utmSource: req.body.utmSource,
                            utmTerm: req.body.utmTerm,
                            city: req.body.city,
                            productCode: req.body.productCode,
                            actionType: req.body.actionType,
                            company: {
                                name: req.body.company,
                                address: req.body.address,
                                inn: req.body.inn,
                                ogrn: req.body.ogrn,
                                rs: req.body.rs,
                                bik: req.body.bik_bank,
                                address_delivery: req.body.address_delivery
                            }
                        };
                        console.log('New lead: ' + JSON.stringify(data));
                        if (!data.name)
                            return;

                        amoQueue.add({type: 'lead', payload: data}, function (err, id) {
                            res.status(200).send({id});
                        });
                    });

                    function getAuthPromise() {
                        return amo.auth({
                            USER_LOGIN: login,
                            USER_HASH: key
                        });
                    }

                    function getReferer(utmSource) {
                        switch (utmSource) {
                            case '(pap)':
                                return 'Агенты modul.club';
                            default:
                                return 'Сайт modulkassa.ru';
                        }
                    }

                    function addLead(data) {
                        let name = data.name || 'Без Имени';
                        return amo.createLead(
                            {
                                name: `Заказ от ${name}`,
                                custom_fields: [
                                    getField(110947, getReferer(data.utmSource)),//Ресурс
                                    getField(111005, data.utmSource),//utm_source
                                ]
                            }).then((lead) => {
                            if (lead) {
                                amoQueue.add({
                                    type: 'contact',
                                    payload: {
                                        name: name,
                                        phone: data.phone,
                                        email: data.email,
                                        leadId: lead.id
                                    }
                                }, function (err, id) {
                                    console.log('Contact added to queue ' + id);
                                });
                                if (data.company) {
                                    amoQueue.add({
                                        type: 'company',
                                        payload: Object.assign(data.company, {leadId: lead.id})
                                    }, function (err, id) {
                                        console.log('Company added to queue ' + id);
                                    });
                                }
                                return lead;
                            }
                        });
                    }

                    function addContact(data) {
                        if (!data.name)
                            return;
                        if (!data.phone && !data.email)
                            return;
                        //получить контакт
                        return amo.getContactsList({
                            "query": data.phone
                        }).then((contacts) => {
                            if (contacts && contacts.length) {
                                let contact = contacts[0];
                                let leadIds = contact.leads.id || [];
                                leadIds.push(data.leadId);
                                let updated_at = new Date().getTime();

                                return amo.updateContact(
                                    {
                                        id: contact.id,
                                        updated_at: updated_at,
                                        leads_id: leadIds
                                    }
                                );
                            } else {
                                return amo.createContact(createContact(data.name, data.phone, data.email, [data.leadId]));
                            }
                        });
                    }

                    function addCompany(data) {
                        if (!data.name)
                            return;
                        //получить контакт
                        return amo.getCompanyList({
                            "query": data.phone
                        }).then((companies) => {
                            if (companies && companies.length) {
                                let company = companies[0];
                                let leadIds = company.leads.id || [];
                                leadIds.push(data.leadId);
                                let updated_at = new Date().getTime();

                                return amo.updateCompany(
                                    {
                                        id: company.id,
                                        updated_at: updated_at,
                                        leads_id: leadIds
                                    }
                                );
                            } else {
                                return amo.createCompany(createCompany(data.name, data.leadId, data.inn, data.ogrn, data.rs, data.bik, data.address));
                            }
                        });
                    }

                    amoAuthQueue.add('auth', function (err, id) {
                        console.log('Auth added to queue ' + id);
                    });
                    getMessage();

                }
            )
            ;
        }
    )
    ;

    function getField(id, value) {
        return {
            id: id,
            values: [{
                value: value
            }
            ]
        }
    }

    function getEnumField(id, value, enumValue) {
        return {
            id: id,
            values: [{
                value: value,
                enum: enumValue

            }
            ]
        }
    }
};