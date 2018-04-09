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
                        };

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
                        switch (utmSource){
                            case '(pap)':
                                return 'Агенты modul.club';
                            default:
                                return 'Сайт modulkassa.ru';
                        }
                    }

                    function addLead(data) {
                        return amo.createLead(
                            {
                                name: `Заказ от ${data.name}`,
                                custom_fields: [
                                    getField(110947, getReferer(data.utmSource)),//Ресурс
                                    getField(111005, data.utmSource),//utm_source
                                ]
                            }).then((lead) => {
                            if (lead) {
                                amoQueue.add({
                                    type: 'contact',
                                    payload: {
                                        name: data.name,
                                        phone: data.phone,
                                        email: data.email,
                                        leadId: lead.id
                                    }
                                }, function (err, id) {
                                    console.log('Contact added to queue ' + id);
                                });
                                return lead;
                            }
                        });
                    }

                    function addContact(data) {
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